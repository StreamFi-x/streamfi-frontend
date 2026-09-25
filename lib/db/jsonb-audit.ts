/**
 * Audit / backfill for the users JSONB columns (#1407).
 *
 * Scans users in bounded keyset batches and classifies every value with the
 * contracts in lib/db/jsonb-contracts.ts. Reports never include stored values
 * (they can hold personal data) — only user ids, column names, classifications
 * and schema issue paths.
 *
 * Actions (always explicit, never part of a migration):
 *   report     read-only
 *   normalize  rewrite "normalizable" values to their canonical form
 *   quarantine move "invalid" values into jsonb_quarantine (complete original
 *              value preserved) and reset the column to its empty value; for
 *              notifications only the invalid elements are removed
 * Every write is conditional on the value still being what was classified, so
 * a concurrent user update is never overwritten.
 */
import { sql } from "@vercel/postgres";
import {
  classifyCreator,
  classifyNotifications,
  classifySocialLinks,
  type Classification,
  type JsonbColumn,
} from "@/lib/db/jsonb-contracts";
import { finishJobRun, startJobRun } from "@/lib/jobs/runs";

export type AuditAction = "report" | "normalize" | "quarantine";

export interface AuditFinding {
  userId: string;
  column: JsonbColumn;
  classification: Exclude<Classification, "valid">;
  issues: string[];
}

export interface AuditReport {
  runId: string;
  action: AuditAction;
  scanned: number;
  nextCursor: string | null;
  counts: Record<JsonbColumn, Record<Classification, number>>;
  normalized: number;
  quarantined: number;
  skippedConcurrentChange: number;
  findings: AuditFinding[];
}

const MAX_BATCH = 500;

function emptyCounts(): Record<Classification, number> {
  return { valid: 0, normalizable: 0, legacy: 0, nonconforming: 0, invalid: 0 };
}

export async function auditUsersJsonb(options: {
  action: AuditAction;
  cursor?: string | null;
  limit?: number;
  actor: string;
}): Promise<AuditReport> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), MAX_BATCH);
  const runId = await startJobRun("jsonb-audit", { abandonStale: false });

  const report: AuditReport = {
    runId,
    action: options.action,
    scanned: 0,
    nextCursor: null,
    counts: {
      sociallinks: emptyCounts(),
      creator: emptyCounts(),
      notifications: emptyCounts(),
    },
    normalized: 0,
    quarantined: 0,
    skippedConcurrentChange: 0,
    findings: [],
  };

  try {
    const { rows } = await sql`
      SELECT id, sociallinks, creator, notifications
      FROM users
      WHERE id > COALESCE(${options.cursor ?? null}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY id
      LIMIT ${limit}
    `;

    for (const row of rows) {
      report.scanned++;
      await auditRow(row, options, report);
    }

    report.nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    await finishJobRun(runId, "completed", summarize(report));
    return report;
  } catch (err) {
    await finishJobRun(
      runId,
      "failed",
      summarize(report),
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
}

async function auditRow(
  row: Record<string, unknown>,
  options: { action: AuditAction; actor: string },
  report: AuditReport
) {
  const userId = String(row.id);

  for (const column of ["sociallinks", "creator"] as const) {
    const stored = row[column];
    const result =
      column === "sociallinks"
        ? classifySocialLinks(stored)
        : classifyCreator(stored);
    report.counts[column][result.classification]++;
    if (result.classification === "valid") {
      continue;
    }
    report.findings.push({
      userId,
      column,
      classification: result.classification,
      issues: result.issues,
    });

    if (
      options.action === "normalize" &&
      result.classification === "normalizable"
    ) {
      const changed = await normalizeValue(
        userId,
        column,
        stored,
        result.canonical
      );
      countWrite(report, changed, "normalized");
    }

    if (
      options.action === "quarantine" &&
      result.classification === "invalid"
    ) {
      const changed = await quarantineValue(
        userId,
        column,
        stored,
        result.issues.join("; ") || "invalid",
        options.actor
      );
      countWrite(report, changed, "quarantined");
    }
  }

  const notifications = classifyNotifications(row.notifications);
  report.counts.notifications[notifications.classification]++;
  if (notifications.classification !== "valid") {
    report.findings.push({
      userId,
      column: "notifications",
      classification: notifications.classification,
      issues: notifications.issues,
    });
  }
  if (
    options.action === "quarantine" &&
    notifications.classification === "invalid"
  ) {
    const changed = await quarantineNotifications(
      userId,
      row.notifications,
      notifications.invalidIndexes,
      notifications.issues.join("; "),
      options.actor
    );
    countWrite(report, changed, "quarantined");
  }
}

function countWrite(
  report: AuditReport,
  changed: boolean,
  field: "normalized" | "quarantined"
) {
  if (changed) {
    report[field]++;
  } else {
    report.skippedConcurrentChange++;
  }
}

async function normalizeValue(
  userId: string,
  column: "sociallinks" | "creator",
  original: unknown,
  canonical: unknown
): Promise<boolean> {
  const before = JSON.stringify(original);
  const after = JSON.stringify(canonical ?? {});
  const result =
    column === "sociallinks"
      ? await sql`
          UPDATE users SET sociallinks = ${after}::jsonb
          WHERE id = ${userId} AND sociallinks = ${before}::jsonb
        `
      : await sql`
          UPDATE users SET creator = ${after}::jsonb
          WHERE id = ${userId} AND creator = ${before}::jsonb
        `;
  return result.rowCount === 1;
}

async function quarantineValue(
  userId: string,
  column: "sociallinks" | "creator",
  original: unknown,
  reason: string,
  actor: string
): Promise<boolean> {
  const before = JSON.stringify(original);
  // One statement: the quarantine insert and the reset commit together.
  const result =
    column === "sociallinks"
      ? await sql`
          WITH q AS (
            INSERT INTO jsonb_quarantine (table_name, row_id, column_name, original_value, reason, quarantined_by)
            SELECT 'users', id, 'sociallinks', sociallinks, ${reason}, ${actor}
            FROM users
            WHERE id = ${userId} AND sociallinks = ${before}::jsonb
            RETURNING row_id
          )
          UPDATE users SET sociallinks = '{}'::jsonb
          WHERE id IN (SELECT row_id FROM q)
        `
      : await sql`
          WITH q AS (
            INSERT INTO jsonb_quarantine (table_name, row_id, column_name, original_value, reason, quarantined_by)
            SELECT 'users', id, 'creator', creator, ${reason}, ${actor}
            FROM users
            WHERE id = ${userId} AND creator = ${before}::jsonb
            RETURNING row_id
          )
          UPDATE users SET creator = '{}'::jsonb
          WHERE id IN (SELECT row_id FROM q)
        `;
  return result.rowCount === 1;
}

async function quarantineNotifications(
  userId: string,
  original: unknown,
  invalidIndexes: number[],
  reason: string,
  actor: string
): Promise<boolean> {
  const before = JSON.stringify(original);
  // Postgres arrays are 1-based; invalidIndexes are 0-based.
  const invalidPositions = `{${invalidIndexes.map(i => i + 1).join(",")}}`;
  const result = await sql`
    WITH q AS (
      INSERT INTO jsonb_quarantine (table_name, row_id, column_name, original_value, reason, quarantined_by)
      SELECT 'users', id, 'notifications', to_jsonb(notifications), ${reason}, ${actor}
      FROM users
      WHERE id = ${userId} AND to_jsonb(notifications) = ${before}::jsonb
      RETURNING row_id
    )
    UPDATE users
    SET notifications = ARRAY(
      SELECT t.el
      FROM unnest(users.notifications) WITH ORDINALITY AS t(el, pos)
      WHERE t.pos <> ALL (${invalidPositions}::int[])
      ORDER BY t.pos
    )
    WHERE id IN (SELECT row_id FROM q)
  `;
  return result.rowCount === 1;
}

function summarize(report: AuditReport): Record<string, unknown> {
  return {
    action: report.action,
    scanned: report.scanned,
    counts: report.counts,
    normalized: report.normalized,
    quarantined: report.quarantined,
    skipped_concurrent_change: report.skippedConcurrentChange,
    next_cursor: report.nextCursor,
  };
}
