import { sql } from "@vercel/postgres";

export async function ensureLiveQueueSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_live_queue_settings (
      stream_id UUID PRIMARY KEY REFERENCES stream_sessions(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_open BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS route_f_live_queue_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
      viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'completed', 'left')),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at TIMESTAMPTZ,
      advanced_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_live_queue_settings_creator
    ON route_f_live_queue_settings (creator_id, updated_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_live_queue_entries_stream_status
    ON route_f_live_queue_entries (stream_id, status, joined_at ASC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_live_queue_entries_viewer_status
    ON route_f_live_queue_entries (viewer_id, status, joined_at DESC)
  `;
}
