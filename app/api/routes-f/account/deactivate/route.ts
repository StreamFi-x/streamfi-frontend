import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

// ────────────────────────────────────────────────────────────────
// POST /api/routes-f/account/deactivate
// Temporarily deactivate the authenticated user's account.
// ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    // Ensure columns exist
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ`;

    // Check current status
    const { rows: userRows } = await sql`
      SELECT status FROM users WHERE id = ${session.userId} LIMIT 1
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentStatus = userRows[0].status ?? "active";

    if (currentStatus === "deactivated") {
      return NextResponse.json(
        { error: "Account is already deactivated" },
        { status: 409 }
      );
    }

    if (currentStatus === "pending_deletion") {
      return NextResponse.json(
        { error: "Cannot deactivate account pending deletion" },
        { status: 409 }
      );
    }

    // Deactivate
    await sql`
      UPDATE users
      SET status = 'deactivated',
          deactivated_at = NOW(),
          is_live = false,
          updated_at = NOW()
      WHERE id = ${session.userId}
    `;

    return NextResponse.json({
      message: "Account deactivated successfully",
      status: "deactivated",
      deactivated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[routes-f/account/deactivate] POST error:", error);
    return NextResponse.json(
      { error: "Failed to deactivate account" },
      { status: 500 }
    );
  }
}
