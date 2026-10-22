/**
 * Lightweight run-tracking for the one-off / operational scripts in
 * `scripts/` (distinct from the versioned schema migrations tracked by
 * `lib/migrations/` + `schema_migrations` -- see docs/database-migrations.md).
 *
 * The scripts here are ad-hoc data migrations and cron jobs, not schema
 * changes, and several of them (see docs/scripts-registry.md) are genuinely
 * unsafe to run twice or out of order against a given database. This module
 * gives them a shared `script_runs` table so a script can check "have I
 * already run against this database" before doing anything destructive,
 * without pulling every data migration into the full schema-migration
 * machinery (transactions, checksums, advisory locks) that doesn't fit a
 * script that, say, re-encrypts rows in batches over several invocations.
 */
import type { MigrationClient } from "../migrations/runner";

const CREATE_TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS script_runs (
  script_id   TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  run_by      TEXT,
  note        TEXT
)`;

export type ScriptRunStatus = "running" | "completed" | "failed";

export interface ScriptRunRow {
  script_id: string;
  status: ScriptRunStatus;
  started_at: Date;
  finished_at: Date | null;
  run_by: string | null;
  note: string | null;
}

async function ensureTable(client: MigrationClient): Promise<void> {
  await client.query(CREATE_TRACKING_TABLE);
}

/**
 * Looks up the recorded run for `scriptId`, creating the tracking table on
 * first use. Returns `null` if the script has never been run against this
 * database.
 */
export async function getScriptRun(
  client: MigrationClient,
  scriptId: string
): Promise<ScriptRunRow | null> {
  await ensureTable(client);
  const { rows } = await client.query(
    "SELECT * FROM script_runs WHERE script_id = $1",
    [scriptId]
  );
  return (rows[0] as ScriptRunRow | undefined) ?? null;
}

export class ScriptAlreadyRanError extends Error {
  constructor(
    public readonly scriptId: string,
    public readonly previousRun: ScriptRunRow
  ) {
    super(
      `"${scriptId}" already ran against this database ` +
        `(status: ${previousRun.status}, at ${previousRun.started_at.toISOString()}). ` +
        "This script is not safe to run twice; pass --force to override, " +
        "or delete its script_runs row only after verifying by hand that " +
        "re-running it will not corrupt data."
    );
    this.name = "ScriptAlreadyRanError";
  }
}

export interface RunOnceOptions {
  /** Skip the "already ran" guard. Only for a script's own --force flag. */
  force?: boolean;
  runBy?: string;
}

/**
 * Runs `fn` exactly once per database for a script that is **not safe** to
 * re-run (e.g. drops/recreates a table unconditionally). Records `running`
 * before starting and `completed`/`failed` after, so a crash mid-run leaves
 * a `running` row an operator must resolve by hand rather than silently
 * allowing a second destructive attempt.
 *
 * Idempotent scripts (safe to re-run, e.g. `ADD COLUMN IF NOT EXISTS`) do
 * not need this guard -- note that in the script's own header instead, per
 * docs/scripts-registry.md.
 */
export async function runOnce(
  client: MigrationClient,
  scriptId: string,
  fn: () => Promise<void>,
  options: RunOnceOptions = {}
): Promise<void> {
  await ensureTable(client);

  const existing = await getScriptRun(client, scriptId);
  if (existing && existing.status !== "failed" && !options.force) {
    throw new ScriptAlreadyRanError(scriptId, existing);
  }

  await client.query(
    `INSERT INTO script_runs (script_id, status, run_by)
     VALUES ($1, 'running', $2)
     ON CONFLICT (script_id)
     DO UPDATE SET status = 'running', started_at = NOW(), finished_at = NULL, run_by = $2`,
    [scriptId, options.runBy ?? null]
  );

  try {
    await fn();
    await client.query(
      "UPDATE script_runs SET status = 'completed', finished_at = NOW() WHERE script_id = $1",
      [scriptId]
    );
  } catch (error) {
    await client.query(
      "UPDATE script_runs SET status = 'failed', finished_at = NOW(), note = $2 WHERE script_id = $1",
      [scriptId, error instanceof Error ? error.message : String(error)]
    );
    throw error;
  }
}
