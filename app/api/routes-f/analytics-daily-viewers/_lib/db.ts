import { sql } from "@vercel/postgres";

export async function ensureDailyViewersDependencies(): Promise<void> {
  // Reuses route_f_watch_events (created by the routes-f/analytics route) as
  // the source of truth for viewer activity — one row per watch session.
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_watch_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stream_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      duration_seconds INTEGER NOT NULL,
      category VARCHAR(80) NOT NULL,
      watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_watch_events_stream_time
      ON route_f_watch_events (stream_id, watched_at DESC)
  `;
}
