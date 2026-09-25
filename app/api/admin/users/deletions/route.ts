import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorized, verifyAdminSession } from "@/lib/admin-auth";
import { listDeletions } from "@/lib/users/deletion";

export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "pending",
  "cancelled",
  "purging",
  "failed",
  "purged",
]);

/**
 * GET /api/admin/users/deletions?status=<status>
 * Without `status`: every open deletion (pending, purging, failed), soonest
 * purge first.
 */
export async function GET(req: NextRequest): Promise<Response> {
  if (!(await verifyAdminSession())) {
    return adminUnauthorized();
  }
  const status = new URL(req.url).searchParams.get("status");
  if (status && !STATUSES.has(status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }
  try {
    const deletions = await listDeletions(status);
    return NextResponse.json({ deletions });
  } catch (err) {
    console.error("[admin/users/deletions] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
