import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdminIdentity, requireAdminSession } from "@/lib/admin-auth";
import {
  listFindings,
  remediateFinding,
  type RemediationAction,
} from "@/lib/mux/asset-reconciliation";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["open", "remediated", "resolved", "dismissed"]);
const ACTIONS = new Set<RemediationAction>([
  "dismiss",
  "delete_mux_asset",
  "adopt",
  "mark_unavailable",
  "restore",
]);

/**
 * GET /api/admin/reconciliation/mux?status=open
 * Drift findings (default: open) plus the most recent sweep runs.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const adminDenied = await requireAdminSession("admin/reconciliation/mux");
  if (adminDenied) {
    return adminDenied;
  }
  const status = new URL(req.url).searchParams.get("status");
  if (status && !STATUSES.has(status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }
  try {
    const [findings, runs] = await Promise.all([
      listFindings(status),
      sql`
        SELECT id, run_id, status, started_at, finished_at, duration_ms, metrics, error
        FROM job_runs
        WHERE job_name = 'mux-asset-reconciliation'
        ORDER BY started_at DESC
        LIMIT 10
      `,
    ]);
    return NextResponse.json({ findings, runs: runs.rows });
  } catch (err) {
    console.error("[admin/reconciliation/mux] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/reconciliation/mux  { findingId, action }
 * action: dismiss | delete_mux_asset | adopt | mark_unavailable | restore
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { admin, response } = await requireAdminIdentity(
    "admin/reconciliation/mux"
  );
  if (response) {
    return response;
  }
  let body: { findingId?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    typeof body.findingId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.findingId) ||
    typeof body.action !== "string" ||
    !ACTIONS.has(body.action as RemediationAction)
  ) {
    return NextResponse.json(
      { error: "findingId (uuid) and a valid action are required" },
      { status: 400 }
    );
  }
  try {
    const result = await remediateFinding(
      body.findingId,
      body.action as RemediationAction,
      `admin:${admin}`
    );
    return result.ok
      ? NextResponse.json(result)
      : NextResponse.json({ error: result.error }, { status: result.status });
  } catch (err) {
    console.error("[admin/reconciliation/mux] POST error:", err);
    return NextResponse.json({ error: "Remediation failed" }, { status: 502 });
  }
}
