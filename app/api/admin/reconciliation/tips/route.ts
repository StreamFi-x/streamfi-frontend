import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { adminUnauthorized, verifyAdminSession } from "@/lib/admin-auth";
import { TIP_RECONCILIATION_JOB } from "@/lib/alerts/tip-reconciliation-alerts";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reconciliation/tips
 * Recent reconciliation runs with their correction aggregates, recent alerts
 * (including failed/suppressed deliveries) and runs still awaiting alert
 * evaluation — the operational view for investigating drift.
 */
export async function GET(): Promise<Response> {
  if (!(await verifyAdminSession())) {
    return adminUnauthorized();
  }
  try {
    const [runs, alerts, unevaluated] = await Promise.all([
      sql`
        SELECT r.id, r.status, r.started_at, r.finished_at, r.metrics, r.error,
               r.alert_evaluated_at,
               count(c.id) FILTER (WHERE c.applied) AS corrections_count,
               COALESCE(sum(c.delta_abs) FILTER (WHERE c.applied), 0)::text AS correction_amount_xlm,
               count(c.id) FILTER (WHERE NOT c.applied) AS flagged_count
        FROM job_runs r
        LEFT JOIN tip_reconciliation_corrections c ON c.run_id = r.id
        WHERE r.job_name = ${TIP_RECONCILIATION_JOB}
        GROUP BY r.id
        ORDER BY r.started_at DESC
        LIMIT 50
      `,
      sql`
        SELECT id, run_id, severity, status, signature, attempts, last_error,
               created_at, delivered_at, payload
        FROM reconciliation_alerts
        ORDER BY created_at DESC
        LIMIT 50
      `,
      sql`
        SELECT id, status, started_at FROM job_runs
        WHERE job_name = ${TIP_RECONCILIATION_JOB}
          AND status <> 'running'
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
