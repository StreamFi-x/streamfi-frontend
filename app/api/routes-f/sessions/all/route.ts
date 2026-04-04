import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

async function ensureSessionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      device     TEXT,
      ip_region  TEXT,
      last_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function getSessionTokenHash(req: NextRequest): string | null {
  const token =
    req.cookies.get("wallet_session")?.value ??
    req.cookies.get("privy_session")?.value ??
    req.cookies.get("wallet")?.value ??
    null;
  if (!token) {
    return null;
  }
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
  }
  return (
    Math.abs(h).toString(16).padStart(8, "0") +
    token.slice(-24).replace(/[^a-zA-Z0-9]/g, "x")
  );
}

/** DELETE /api/routes-f/sessions/all — revoke all sessions except current */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureSessionsTable();

    const currentHash = getSessionTokenHash(req);

    if (currentHash) {
      await sql`
        DELETE FROM user_sessions
        WHERE user_id = ${session.userId}
          AND token_hash != ${currentHash}
      `;
    } else {
      // No identifiable current session — revoke all
      await sql`
        DELETE FROM user_sessions
        WHERE user_id = ${session.userId}
      `;
    }

    return NextResponse.json({ message: "All other sessions revoked" });
  } catch (error) {
    console.error("[routes-f sessions/all DELETE]", error);
    return NextResponse.json(
      { error: "Failed to revoke sessions" },
      { status: 500 }
    );
  }
}
