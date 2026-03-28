import { sql } from "@vercel/postgres";

export async function ensureTemplatesSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_stream_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      title VARCHAR(140) NOT NULL,
      category VARCHAR(80),
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_route_f_stream_templates_user_name
      ON route_f_stream_templates (user_id, LOWER(name))
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_templates_user_created
      ON route_f_stream_templates (user_id, created_at DESC)
  `;
}
