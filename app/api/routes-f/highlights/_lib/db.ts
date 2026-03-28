import { sql } from "@vercel/postgres";

export async function ensureHighlightsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_highlights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recording_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      playback_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_highlights_user_created
      ON route_f_highlights (user_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_highlights_recording
      ON route_f_highlights (recording_id, created_at DESC)
  `;
}
