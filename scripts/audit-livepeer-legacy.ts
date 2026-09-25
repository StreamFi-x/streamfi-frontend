#!/usr/bin/env node
/**
 * Read-only audit of Livepeer leftovers (#1408). Prints aggregate counts only:
 * no identifiers, usernames or wallet addresses leave the database.
 *
 * Usage:
 *   POSTGRES_URL=... npx tsx scripts/audit-livepeer-legacy.ts
 *
 * Run it before and after db/migrations/20260925190100_retire_livepeer_columns.sql.
 */

import { sql } from "@vercel/postgres";
import {
  auditLivepeerLegacy,
  type LivepeerAuditReport,
} from "../lib/maintenance/livepeer-legacy";

function summarize(report: LivepeerAuditReport): string {
  const lines: string[] = [];
  for (const c of report.columns) {
    if (!c.present) {
      lines.push(`${c.table}.${c.column}: absent`);
      continue;
    }
    lines.push(
      `${c.table}.${c.column}: present (nullable=${c.nullable}) rows=${c.totalRows} ` +
        `non_null=${c.nonNull} migrated=${c.byDisposition.migrated} ` +
        `unprovisioned=${c.byDisposition.unprovisioned} ` +
        `legacy_history=${c.byDisposition.legacy_history}`
    );
  }
  lines.push(
    report.indexes.length === 0
      ? "legacy indexes: none"
      : `legacy indexes: ${report.indexes.map(i => `${i.name} (${i.table})`).join(", ")}`
  );
  lines.push(
    `legacy_livepeer_refs: ${report.archivedRows === null ? "absent" : `${report.archivedRows} rows`}`
  );
  return lines.join("\n");
}

async function main() {
  const report = await auditLivepeerLegacy((text, params) =>
    sql.query(text, params as unknown[])
  );
  console.log(summarize(report));
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("[audit-livepeer-legacy] failed:", err);
    process.exit(1);
  });
