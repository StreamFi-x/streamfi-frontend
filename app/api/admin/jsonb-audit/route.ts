import { NextRequest, NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-auth";
import { auditUsersJsonb, type AuditAction } from "@/lib/db/jsonb-audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/jsonb-audit?cursor=<uuid>&limit=<n>
 * Read-only audit of users.sociallinks / creator / notifications (#1407).
 * Page through with `nextCursor` until it is null.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { admin, response } = await requireAdminIdentity("admin/jsonb-audit");
  if (response) {
    return response;
  }
  const { searchParams } = new URL(req.url);
  return runAudit("report", admin, {
    cursor: searchParams.get("cursor"),
    limit: Number(searchParams.get("limit") ?? 200),
  });
}

/**
 * POST /api/admin/jsonb-audit  { action: "normalize" | "quarantine", cursor?, limit? }
 * Applies the explicit repair action to one batch.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { admin, response } = await requireAdminIdentity("admin/jsonb-audit");
  if (response) {
    return response;
  }
  let body: { action?: string; cursor?: string | null; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "normalize" && body.action !== "quarantine") {
    return NextResponse.json(
      { error: "action must be 'normalize' or 'quarantine'" },
      { status: 400 }
    );
  }
  return runAudit(body.action, admin, {
    cursor: body.cursor ?? null,
    limit: body.limit,
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function runAudit(
  action: AuditAction,
  actor: string,
  { cursor, limit }: { cursor: string | null; limit?: number }
): Promise<Response> {
  if (cursor && !UUID_RE.test(cursor)) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }
  try {
    const report = await auditUsersJsonb({
      action,
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
      actor,
    });
    return NextResponse.json(report);
  } catch (err) {
    console.error("[admin/jsonb-audit] failed:", err);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}
