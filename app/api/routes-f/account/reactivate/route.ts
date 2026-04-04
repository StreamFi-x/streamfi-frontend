import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

// ────────────────────────────────────────────────────────────────
// POST /api/routes-f/account/reactivate
// Reactivate a deactivated account. Instant, no approval required.
// ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

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

    if (currentStatus === "active") {
      return NextResponse.json(
        { error: "Account is already active" },
        { status: 409 }
      );
    }

    if (currentStatus === "pending_deletion") {
      return NextResponse.json(
        {
          error:
            "Cannot reactivate account pending deletion. Cancel deletion first.",
        },
        { status: 409 }
      );
    }

    if (currentStatus !== "deactivated") {
      return NextResponse.json(
        { error: `Cannot reactivate account with status: ${currentStatus}` },
        { status: 409 }
      );
    }

    // Reactivate
    await sql`
      UPDATE users
      SET status = 'active',
          deactivated_at = NULL,
          updated_at = NOW()
      WHERE id = ${session.userId}
    `;

    return NextResponse.json({
      message: "Account reactivated successfully",
      status: "active",
    });
  } catch (error) {
    console.error("[routes-f/account/reactivate] POST error:", error);
    return NextResponse.json(
      { error: "Failed to reactivate account" },
      { status: 500 }
    );
  }
}
