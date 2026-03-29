import { sql } from "@vercel/postgres";

export type RecordingVisibility = "public" | "unlisted" | "private";

export async function ensureRecordingSchema(): Promise<void> {
    await sql`
    CREATE TABLE IF NOT EXISTS route_f_stream_recordings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mux_playback_id VARCHAR(255) NOT NULL,
      mux_asset_id VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      visibility VARCHAR(20) NOT NULL DEFAULT 'private',
      thumbnail_url TEXT,
      duration_seconds INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

    await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_recordings_user
      ON route_f_stream_recordings (user_id, created_at DESC)
  `;

    await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_recordings_visibility
      ON route_f_stream_recordings (visibility, created_at DESC)
  `;
}
