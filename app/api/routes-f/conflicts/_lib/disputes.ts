/**
 * DB helpers for username disputes.
 */

import { sql } from "@vercel/postgres";

export async function ensureDisputesTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS username_disputes (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      claimed_username TEXT        NOT NULL,
      claimant_user_id UUID        NOT NULL REFERENCES users(id),
      reason           TEXT        NOT NULL,
      status           TEXT        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open', 'resolved', 'denied')),
      resolved_by      UUID        REFERENCES users(id),
      resolved_action  TEXT        CHECK (resolved_action IN ('transfer', 'deny')),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at      TIMESTAMPTZ
    )
  `;
}
