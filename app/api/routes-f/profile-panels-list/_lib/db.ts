import { sql } from "@vercel/postgres";

export async function ensureProfilePanelsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS channel_panels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL,
      body TEXT NOT NULL,
      image_url VARCHAR(2048),
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_channel_panels_channel_position
      ON channel_panels (channel_id, position ASC)
  `;
}
