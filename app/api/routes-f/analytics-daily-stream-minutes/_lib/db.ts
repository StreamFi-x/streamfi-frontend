import { sql } from "@vercel/postgres";

export async function ensureDailyStreamMinutesDependencies(): Promise<void> {
  // One row per broadcast session — the creator's own live-stream time,
  // distinct from route_f_watch_events (which tracks viewer watch time).
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_broadcast_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      duration_seconds INTEGER NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT route_f_broadcast_sessions_duration_check
        CHECK (duration_seconds >= 0)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_broadcast_sessions_creator_time
      ON route_f_broadcast_sessions (creator_id, started_at DESC)
  `;
}
