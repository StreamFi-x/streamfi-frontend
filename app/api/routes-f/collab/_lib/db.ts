import { sql } from "@vercel/postgres";

/**
 * Ensures the collab_requests table existence.
 */
export async function ensureCollabSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS collab_requests (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status        VARCHAR(20) NOT NULL DEFAULT 'pending' 
                    CHECK (status IN ('pending', 'accepted', 'declined')),
      message       TEXT        NOT NULL,
      proposed_date TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- Prevent duplicate pending requests between same pair
      UNIQUE(sender_id, receiver_id, status)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_collab_sender ON collab_requests(sender_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_collab_receiver ON collab_requests(receiver_id)`;
}
