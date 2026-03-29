import { sql } from "@vercel/postgres";

export async function ensureAnalyticsSchema(): Promise<void> {
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
    CREATE INDEX IF NOT EXISTS idx_route_f_watch_events_user_time
      ON route_f_watch_events (user_id, watched_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_watch_events_stream_time
      ON route_f_watch_events (stream_id, watched_at DESC)
  `;
}
