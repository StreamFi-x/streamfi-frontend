import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function PATCH(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { rows: adminRows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  const role = adminRows[0]?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  let body: { flagKey?: string; enabled?: boolean; rollout_percentage?: number; rolloutPercentage?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const flagKey = body.flagKey;
  if (!flagKey) {
    return NextResponse.json({ error: "flagKey is required" }, { status: 400 });
  }

  const rolloutPercentage = body.rollout_percentage ?? body.rolloutPercentage;

  if (body.enabled === undefined && rolloutPercentage === undefined) {
    return NextResponse.json(
      { error: "Must provide either enabled boolean or rollout percentage" },
      { status: 400 }
    );
  }

  if (rolloutPercentage !== undefined && (rolloutPercentage < 0 || rolloutPercentage > 100)) {
    return NextResponse.json(
      { error: "rollout percentage must be between 0 and 100" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      UPDATE feature_flags
      SET
        enabled = COALESCE(${body.enabled ?? null}, enabled),
        rollout_percentage = COALESCE(${rolloutPercentage ?? null}, rollout_percentage),
        updated_at = NOW()
      WHERE flag_key = ${flagKey}
      RETURNING flag_key, name, enabled, rollout_percentage, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Feature flag updated successfully",
      feature_flag: rows[0],
    });
  } catch (err) {
    console.error("[admin-feature-flag-update] PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
