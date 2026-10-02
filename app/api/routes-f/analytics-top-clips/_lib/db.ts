import { sql } from "@vercel/postgres";

export async function ensureTopClipsDependencies(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_clips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_clips_creator_views
      ON route_f_clips (creator_id, view_count DESC)
  `;
}
