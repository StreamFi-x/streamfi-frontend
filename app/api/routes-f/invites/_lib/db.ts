import { sql } from "@vercel/postgres";

export async function ensureInvitesSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_stream_invites (
      code VARCHAR(8) PRIMARY KEY,
      stream_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      max_uses INTEGER NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_invites_creator_created
      ON route_f_stream_invites (creator_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_stream_invites_stream
      ON route_f_stream_invites (stream_id, created_at DESC)
  `;
}
