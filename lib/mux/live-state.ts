import type { Tx } from "@/lib/postgres-transaction";

/**
 * Live-state transitions shared by the Mux webhook handlers and the Mux ↔ DB
 * reconciliation job, so both paths keep users.is_live and stream_sessions
 * consistent in exactly the same way.
 *
 * Every function runs inside the caller's transaction. Updating the users row
 * first takes its row lock, which serializes concurrent transitions for the
 * same streamer (e.g. a webhook and a reconciliation correction) and makes
 * the "open a session only if none is open" check race-free.
 */

export interface LiveUserRow {
  id: string;
  mux_stream_id: string | null;
  mux_playback_id: string | null;
  creator: { title?: string; streamTitle?: string } | null;
}

function sessionTitle(creator: LiveUserRow["creator"]): string {
  return creator?.title || creator?.streamTitle || "Live Stream";
}

/** Opens a stream session unless the user already has an open one. */
export async function openSessionIfMissing(
  tx: Tx,
  user: LiveUserRow
): Promise<boolean> {
  const { rows } = await tx.sql`
    INSERT INTO stream_sessions (user_id, title, playback_id, started_at, mux_session_id)
    SELECT ${user.id}, ${sessionTitle(user.creator)}, ${user.mux_playback_id},
           CURRENT_TIMESTAMP, ${user.mux_stream_id}
    WHERE NOT EXISTS (
      SELECT 1 FROM stream_sessions
      WHERE user_id = ${user.id} AND ended_at IS NULL
    )
    RETURNING id
  `;
  return rows.length > 0;
}

/** Ends every open stream session for the user. Returns how many closed. */
export async function closeOpenSessions(
  tx: Tx,
  userId: string
): Promise<number> {
  const { rowCount } = await tx.sql`
    UPDATE stream_sessions SET ended_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND ended_at IS NULL
  `;
  return rowCount ?? 0;
}

/** video.live_stream.active: mark the stream's owner(s) live. */
export async function markMuxStreamLive(
  tx: Tx,
  muxStreamId: string
): Promise<string[]> {
  const { rows } = await tx.sql<LiveUserRow>`
    UPDATE users SET
      is_live = true,
      stream_started_at = CURRENT_TIMESTAMP,
      current_viewers = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE mux_stream_id = ${muxStreamId}
    RETURNING id, mux_stream_id, mux_playback_id, creator
  `;
  for (const user of rows) {
    await openSessionIfMissing(tx, user);
  }
  return rows.map(r => r.id);
}

/** video.live_stream.idle: mark the stream's owner(s) offline. */
export async function markMuxStreamOffline(
  tx: Tx,
  muxStreamId: string
): Promise<string[]> {
  const { rows } = await tx.sql<{ id: string }>`
    UPDATE users SET
      is_live = false,
      stream_started_at = NULL,
      current_viewers = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE mux_stream_id = ${muxStreamId}
    RETURNING id
  `;
  for (const user of rows) {
    await closeOpenSessions(tx, user.id);
  }
  return rows.map(r => r.id);
}
