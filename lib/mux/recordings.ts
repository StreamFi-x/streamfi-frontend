import { sql } from "@vercel/postgres";
import type { Tx } from "@/lib/postgres-transaction";

export interface RecordingFromAsset {
  userId: string;
  streamSessionId: string | null;
  assetId: string;
  playbackId: string;
  title: string | null;
  duration: number | null;
}

/**
 * Create (or refresh) the stream_recordings row for a ready Mux asset. Shared
 * by the video.asset.ready webhook handler and the Mux asset reconciliation
 * "adopt" remediation so both write identical rows. Pass `executor` to write
 * inside an open transaction (see withTransaction).
 *
 * New rows get needs_review = true so the owner is prompted. On conflict only
 * status/duration change — needs_review is preserved in case the owner already
 * dismissed the prompt; status, duration and playback_id are refreshed.
 * Returns true when a new row was inserted.
 */
export async function upsertRecordingFromAsset(
  recording: RecordingFromAsset,
  executor: Tx = { sql }
): Promise<boolean> {
  const { rows } = await executor.sql`
    INSERT INTO stream_recordings (
      user_id, stream_session_id, mux_asset_id, playback_id,
      title, duration, status, needs_review
    )
    VALUES (
      ${recording.userId},
      ${recording.streamSessionId},
      ${recording.assetId},
      ${recording.playbackId},
      ${recording.title},
      ${recording.duration ?? 0},
      'ready',
      true
    )
    ON CONFLICT (mux_asset_id) DO UPDATE SET
      status = 'ready',
      duration = COALESCE(EXCLUDED.duration, stream_recordings.duration),
      playback_id = EXCLUDED.playback_id
    RETURNING (xmax = 0) AS inserted
  `;
  return rows[0]?.inserted === true;
}
