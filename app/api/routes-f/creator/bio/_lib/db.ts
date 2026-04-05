import { sql } from "@vercel/postgres";

export async function ensureCreatorBioSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_creator_bios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      bio_text TEXT,
      social_links JSONB DEFAULT '[]'::jsonb,
      schedule_text TEXT,
      banner_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_creator_bios_user
      ON route_f_creator_bios (user_id)
  `;
}
