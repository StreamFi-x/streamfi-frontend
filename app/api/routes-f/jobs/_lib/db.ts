/**
 * Shared DB helpers for the jobs API.
 */

import { sql } from "@vercel/postgres";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type JobType =
  | "export"
  | "clip_process"
  | "batch_notify"
  | "leaderboard_refresh"
  | "sitemap_refresh";

export interface Job {
  id: string;
  user_id: string | null;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export const JOB_TYPES = new Set<JobType>([
  "export",
  "clip_process",
  "batch_notify",
  "leaderboard_refresh",
  "sitemap_refresh",
]);

/** Creates the jobs table and enum types if they don't already exist. */
export async function ensureJobsSchema(): Promise<void> {
  // Use DO $$ block to create types only if missing (DDL is not transactional in PG)
  await sql`
    DO $$ BEGIN
      CREATE TYPE job_status AS ENUM (
        'pending', 'running', 'completed', 'failed', 'cancelled'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE job_type AS ENUM (
        'export', 'clip_process', 'batch_notify', 'leaderboard_refresh', 'sitemap_refresh'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
      type          job_type    NOT NULL,
      status        job_status  NOT NULL DEFAULT 'pending',
      payload       JSONB,
      result        JSONB,
      error         TEXT,
      attempts      INT         NOT NULL DEFAULT 0,
      max_attempts  INT         NOT NULL DEFAULT 3,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS jobs_user_status
      ON jobs (user_id, status, created_at DESC)
  `;
}
