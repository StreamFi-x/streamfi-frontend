import { sql } from "@vercel/postgres";

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
 * by the video.asset.ready webhook and the reconciliation "adopt" remediation
 * so both write identical rows.
 *
 * New rows get needs_review = true so the owner is prompted. On conflict only
 * status/duration change — needs_review is preserved in case the owner already
 * dismissed the prompt. Returns true when a new row was inserted.
 */
export async function upsertRecordingFromAsset(
  recording: RecordingFromAsset
): Promise<boolean> {
  const { rows } = await sql`
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
      duration = COALESCE(EXCLUDED.duration, stream_recordings.duration)
    RETURNING (xmax = 0) AS inserted
  `;
  return rows[0]?.inserted === true;
}
