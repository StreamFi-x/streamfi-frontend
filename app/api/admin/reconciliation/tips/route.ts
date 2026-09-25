import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdminSession } from "@/lib/admin-auth";
import { TIP_RECONCILIATION_JOB } from "@/lib/alerts/tip-reconciliation-alerts";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reconciliation/tips
 * Recent tip reconciliation runs with their correction aggregates, recent
 * anomaly alerts (with their delivery outcome) and runs still awaiting alert
 * evaluation — the operational view for investigating drift (#1405).
 */
export async function GET(): Promise<Response> {
  const adminDenied = await requireAdminSession("admin/reconciliation/tips");
  if (adminDenied) {
    return adminDenied;
  }
  try {
    const [runs, alerts, unevaluated] = await Promise.all([
      sql`
        SELECT r.run_id, r.status, r.started_at, r.duration_ms, r.metrics,
               r.error, r.alert_evaluated_at,
               count(c.id) FILTER (WHERE c.kind = 'TOTALS_CORRECTED') AS corrections_count,
               COALESCE(sum(abs(c.delta)) FILTER (WHERE c.kind = 'TOTALS_CORRECTED'), 0)::text
                 AS correction_amount_xlm,
               count(c.id) FILTER (WHERE c.kind = 'TIP_INSERTED') AS tips_inserted
        FROM job_runs r
        LEFT JOIN tip_reconciliation_corrections c ON c.run_id = r.run_id
        WHERE r.job_name = ${TIP_RECONCILIATION_JOB}
        GROUP BY r.id
        ORDER BY r.started_at DESC
        LIMIT 50
      `,
      sql`
        SELECT id, run_id, severity, signature, delivery, created_at,
               delivered_at, payload
        FROM reconciliation_alerts
        ORDER BY created_at DESC
        LIMIT 50
      `,
      sql`
        SELECT run_id, status, started_at FROM job_runs
        WHERE job_name = ${TIP_RECONCILIATION_JOB}
          AND run_id IS NOT NULL
          AND status <> 'skipped'
          AND alert_evaluated_at IS NULL
        ORDER BY started_at
      `,
    ]);
    return NextResponse.json({
      runs: runs.rows,
      alerts: alerts.rows,
      unevaluatedRuns: unevaluated.rows,
    });
  } catch (err) {
    console.error("[admin/reconciliation/tips] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
