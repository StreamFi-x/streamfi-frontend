import { sql } from "@vercel/postgres";

export async function ensureModerationReportListDependencies(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_moderation_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type VARCHAR(20) NOT NULL,
      target_id VARCHAR(255) NOT NULL,
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT route_f_moderation_reports_status_check
        CHECK (status IN ('open', 'resolved'))
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_moderation_reports_creator_status_time
      ON route_f_moderation_reports (creator_id, status, created_at DESC)
  `;
}
