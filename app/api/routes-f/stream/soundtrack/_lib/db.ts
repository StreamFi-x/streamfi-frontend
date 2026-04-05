import { sql } from "@vercel/postgres";

export async function ensureSoundtrackSchema(): Promise<void> {
  // Soundtrack catalog table
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_soundtrack_catalog (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      artist VARCHAR(255) NOT NULL,
      duration_seconds INT NOT NULL,
      url TEXT NOT NULL,
      royalty_free BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Stream now playing table
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_stream_now_playing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id UUID NOT NULL REFERENCES route_f_soundtrack_catalog(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Stream playlist table
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_stream_playlists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id UUID NOT NULL REFERENCES route_f_soundtrack_catalog(id) ON DELETE CASCADE,
      position INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(stream_id, position)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_now_playing_stream
      ON route_f_stream_now_playing (stream_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_playlists_stream
      ON route_f_stream_playlists (stream_id, position)
  `;
}
