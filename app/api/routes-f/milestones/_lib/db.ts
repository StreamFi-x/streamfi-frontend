import { sql } from "@vercel/postgres";

export const MILESTONE_TYPES = [
  "sub_count",
  "tip_amount",
  "viewer_count",
] as const;

export type MilestoneType = (typeof MILESTONE_TYPES)[number];

export async function ensureMilestonesSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_milestones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      target NUMERIC(20, 7) NOT NULL,
      title VARCHAR(255) NOT NULL,
      reward_description TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_milestones_creator_created
      ON route_f_milestones (creator_id, created_at DESC)
  `;
}
