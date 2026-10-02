import { sql } from "@vercel/postgres";

export async function ensureDailyFollowersDependencies(): Promise<void> {
  // One row per follow/unfollow event, so a single table answers both
  // "new followers" and "unfollows" per day via `event_type`.
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_follow_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type VARCHAR(10) NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT route_f_follow_events_event_type_check
        CHECK (event_type IN ('follow', 'unfollow'))
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_follow_events_creator_time
      ON route_f_follow_events (creator_id, occurred_at DESC)
  `;
}
