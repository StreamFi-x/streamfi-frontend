import { createHmac, timingSafeEqual } from "crypto";
import { sql } from "@vercel/postgres";

// ────────────────────────────────────────────────────────────────
// Mux webhook handler
// ────────────────────────────────────────────────────────────────

/**
 * Verify Mux webhook signature using HMAC-SHA256.
 * Header format: "t=<unix_ts>,v1=<hex_signature>"
 */
export function verifyMuxSignature(
  header: string,
  rawBody: string,
  secret: string
): boolean {
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) {
      parts[k.trim()] = v.trim();
    }
  }

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) {return false;}

  // Reject events older than 5 minutes (replay attack protection)
  const ageSeconds = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (ageSeconds > 300) {
    console.error(`[webhook/mux] Event too old: ${ageSeconds}s`);
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Handle Mux webhook events.
 */
export async function handleMuxEvent(event: Record<string, unknown>): Promise<{
  handled: boolean;
  detail: string;
}> {
  const eventType = event.type as string;
  const data = event.data as Record<string, unknown> | undefined;

  if (!data) {
    return { handled: false, detail: "Missing event data" };
  }

  switch (eventType) {
    case "video.live_stream.active": {
      const streamId = data.id as string;
      if (!streamId) {return { handled: false, detail: "Missing stream ID" };}

      const { rows } = await sql`
        SELECT id, mux_playback_id, creator
        FROM users
        WHERE mux_stream_id = ${streamId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return { handled: false, detail: `No user found for stream ${streamId}` };
      }

      const user = rows[0];
      await sql`
        UPDATE users SET
          is_live = true,
          stream_started_at = COALESCE(stream_started_at, CURRENT_TIMESTAMP),
          current_viewers = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;

      // Create stream session if none active
      const { rows: existing } = await sql`
        SELECT id FROM stream_sessions
        WHERE user_id = ${user.id} AND ended_at IS NULL
        LIMIT 1
      `;

      if (existing.length === 0) {
        const title =
          (user.creator as Record<string, string> | null)?.title || "Live Stream";
        await sql`
          INSERT INTO stream_sessions (user_id, title, playback_id, started_at, mux_session_id)
          VALUES (${user.id}, ${title}, ${user.mux_playback_id}, CURRENT_TIMESTAMP, ${streamId})
        `;
      }

      return { handled: true, detail: `Stream ${streamId} marked active` };
    }

    case "video.live_stream.idle": {
      const streamId = data.id as string;
      if (!streamId) {return { handled: false, detail: "Missing stream ID" };}

      await sql`
        UPDATE users SET
          is_live = false,
          stream_started_at = NULL,
          current_viewers = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE mux_stream_id = ${streamId}
      `;

      const { rows } = await sql`
        SELECT id FROM users WHERE mux_stream_id = ${streamId} LIMIT 1
      `;
      if (rows.length > 0) {
        await sql`
          UPDATE stream_sessions SET ended_at = CURRENT_TIMESTAMP
          WHERE user_id = ${rows[0].id} AND ended_at IS NULL
        `;
      }

      return { handled: true, detail: `Stream ${streamId} marked idle` };
    }

    case "video.asset.ready": {
      const assetId = data.id as string;
      const playbackIds = data.playback_ids as
        | Array<{ id: string }>
        | undefined;
      const duration = data.duration as number | undefined;
      const liveStreamId = data.live_stream_id as string | undefined;
      const playbackId = playbackIds?.[0]?.id;

      if (!assetId || !playbackId) {
        return { handled: false, detail: "Missing asset ID or playback ID" };
      }

      // Find user by live_stream_id
      const { rows } = await sql`
        SELECT id FROM users WHERE mux_stream_id = ${liveStreamId ?? ""} LIMIT 1
      `;

      if (rows.length === 0) {
        return { handled: false, detail: "No user found for recording" };
      }

      await sql`
        INSERT INTO stream_recordings (
          user_id, mux_asset_id, playback_id, title, duration, status
        )
        VALUES (
          ${rows[0].id}, ${assetId}, ${playbackId},
          'stream_recording', ${duration ?? 0}, 'ready'
        )
        ON CONFLICT (mux_asset_id) DO UPDATE SET
          status = 'ready',
          duration = COALESCE(EXCLUDED.duration, stream_recordings.duration)
      `;

      return { handled: true, detail: `Recording ${assetId} marked ready` };
    }

    default:
      return { handled: false, detail: `Unhandled Mux event: ${eventType}` };
  }
}
