import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/replays: recent session replay reconstructions (#1750). */
export async function GET(req: NextRequest) {
  const adminDenied = await requireAdminSession("admin/replays");
  if (adminDenied) {
    return adminDenied;
  }

  const { searchParams } = new URL(req.url);
  const flow = searchParams.get("flow") ?? "all";
  const limit = Math.max(
    1,
    Math.min(Number(searchParams.get("limit") ?? "50") || 50, 100)
  );

  try {
    const result =
      flow === "all"
        ? await sql`
            SELECT id, flow, error_message, error_stack, error_details,
                   breadcrumbs, environment, created_at
            FROM session_replays
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT id, flow, error_message, error_stack, error_details,
                   breadcrumbs, environment, created_at
            FROM session_replays
            WHERE flow = ${flow}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;

    return NextResponse.json({ replays: result.rows });
  } catch (err) {
    console.error("[admin/replays] GET error:", err);
    return NextResponse.json(
      { error: "Unable to load session replays" },
      { status: 500 }
    );
  }
}
