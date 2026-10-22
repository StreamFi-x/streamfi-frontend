import { withTransaction, type Tx } from "@/lib/postgres-transaction";

export const VIEWER_STALE_SECONDS = 90;
export const VIEWER_CONFIRM_SECONDS = 30;

export type ViewerMutation = "join" | "heartbeat" | "leave" | "reconcile";
export interface ViewerMutationInput {
  playbackId?: string;
  userId?: string;
  viewerUserId?: string | null;
  sessionId?: string;
  action: ViewerMutation;
  staleWindowSeconds?: number;
  ip?: string | null;
  country?: string | null;
}
export interface ViewerSnapshot {
  currentViewers: number;
  previousViewers: number;
  abandonedClosed: number;
  inserted: boolean;
  username: string;
}

export type ViewerTransaction = <T>(work: (tx: Tx) => Promise<T>) => Promise<T>;

/** All writers lock the creator first, then the live stream session. Separate
 * statements inside READ COMMITTED see joins committed while waiting for the
 * lock; a single data-modifying CTE would keep its pre-lock snapshot.
 * No network/geolocation work belongs inside this transaction.
 */
export async function mutateViewerTracking(
  input: ViewerMutationInput,
  transaction: ViewerTransaction = withTransaction
): Promise<ViewerSnapshot | null> {
  if (!input.playbackId && !input.userId) {
    throw new Error("A stream identity is required");
  }
  if (input.action !== "reconcile" && !input.sessionId) {
    throw new Error("A viewer session is required");
  }
  return transaction(async tx => {
    const { rows: users } = await tx.sql`
      SELECT id, username, current_viewers FROM users
      WHERE (${input.playbackId ?? null}::text IS NULL OR mux_playback_id = ${input.playbackId ?? null})
        AND (${input.userId ?? null}::uuid IS NULL OR id = ${input.userId ?? null}::uuid)
        AND is_live = true AND deleted_at IS NULL
      FOR UPDATE
    `;
    const user = users[0];
    if (!user) {
      return null;
    }
    const { rows: sessions } = await tx.sql`
      SELECT id FROM stream_sessions
      WHERE user_id = ${user.id} AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1 FOR UPDATE
    `;
    const stream = sessions[0];
    if (!stream) {
      return null;
    }

    // The migration deduplicates legacy records and adds a unique session key.
    let inserted = false;
    if (input.action === "join") {
      const { rows } = await tx.sql`
        INSERT INTO stream_viewers
          (stream_session_id, session_id, user_id, joined_at, heartbeat_at, ip_address, country)
        VALUES (${stream.id}, ${input.sessionId}, ${input.viewerUserId ?? null}, clock_timestamp(), clock_timestamp(),
          ${input.ip ?? null}::inet, ${input.country ?? null})
        ON CONFLICT (stream_session_id, session_id) DO NOTHING
        RETURNING id
      `;
      inserted = rows.length > 0;
    } else if (input.action === "heartbeat") {
      await tx.sql`
        UPDATE stream_viewers SET heartbeat_at = clock_timestamp(), left_at = NULL
        WHERE stream_session_id = ${stream.id} AND session_id = ${input.sessionId}
          AND (left_at IS NULL OR left_reason = 'expired')
      `;
    } else if (input.action === "leave") {
      await tx.sql`
        UPDATE stream_viewers SET left_at = clock_timestamp(), left_reason = 'explicit'
        WHERE stream_session_id = ${stream.id} AND session_id = ${input.sessionId}
          AND (left_at IS NULL OR left_reason = 'expired')
      `;
    }
    const { rows: expired } = await tx.sql`
      UPDATE stream_viewers SET left_at = clock_timestamp(), left_reason = 'expired'
      WHERE stream_session_id = ${stream.id} AND left_at IS NULL
        AND COALESCE(heartbeat_at, joined_at) < clock_timestamp() - make_interval(secs => ${input.staleWindowSeconds ?? VIEWER_STALE_SECONDS})
      RETURNING id
    `;
    const { rows: counts } = await tx.sql`
      SELECT COUNT(DISTINCT session_id)::int AS active,
        COUNT(DISTINCT session_id) FILTER (
          WHERE joined_at <= clock_timestamp() - make_interval(secs => ${VIEWER_CONFIRM_SECONDS})
            AND heartbeat_at >= joined_at + make_interval(secs => ${VIEWER_CONFIRM_SECONDS})
        )::int AS confirmed,
        COUNT(DISTINCT ip_address)::int AS distinct_ips
      FROM stream_viewers
      WHERE stream_session_id = ${stream.id} AND left_at IS NULL
        AND COALESCE(heartbeat_at, joined_at) >= clock_timestamp() - make_interval(secs => ${input.staleWindowSeconds ?? VIEWER_STALE_SECONDS})
    `;
    const count = Number(counts[0].active);
    const confirmed = Number(counts[0].confirmed);
    await tx.sql`
      UPDATE users SET current_viewers = ${count},
        total_views = total_views + ${inserted ? 1 : 0}, updated_at = clock_timestamp()
      WHERE id = ${user.id}
    `;
    await tx.sql`
      UPDATE stream_sessions SET total_unique_viewers = total_unique_viewers + ${inserted ? 1 : 0}
      WHERE id = ${stream.id}
    `;
    // One evidence row per stream, replaced only by a higher confirmed sample.
    // Never feed an unverified legacy peak back into the new high-water mark.
    await tx.sql`
      INSERT INTO stream_viewer_peak_samples
        (stream_session_id, viewer_count, distinct_ips, sampled_at, freshness_seconds, confirmation_seconds)
      VALUES (${stream.id}, ${confirmed}, ${Number(counts[0].distinct_ips)}, clock_timestamp(),
        ${input.staleWindowSeconds ?? VIEWER_STALE_SECONDS}, ${VIEWER_CONFIRM_SECONDS})
      ON CONFLICT (stream_session_id) DO UPDATE SET
        viewer_count = EXCLUDED.viewer_count, distinct_ips = EXCLUDED.distinct_ips,
        sampled_at = EXCLUDED.sampled_at
      WHERE EXCLUDED.viewer_count > stream_viewer_peak_samples.viewer_count
    `;
    await tx.sql`
      UPDATE stream_sessions SET peak_viewers = sample.viewer_count, peak_viewers_verified = true
      FROM stream_viewer_peak_samples sample
      WHERE stream_sessions.id = ${stream.id} AND sample.stream_session_id = stream_sessions.id
    `;
    return {
      currentViewers: count,
      previousViewers: Number(user.current_viewers),
      abandonedClosed: expired.length,
      inserted,
      username: String(user.username),
    };
  });
}
