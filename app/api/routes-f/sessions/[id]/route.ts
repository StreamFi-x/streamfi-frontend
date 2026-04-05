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

/** DELETE /api/routes-f/sessions/[id] — revoke a specific session */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureSessionsTable();

    const { rows } = await sql`
      SELECT id, token_hash, user_id
      FROM user_sessions
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const target = rows[0];

    if (String(target.user_id) !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prevent revoking the current session via this endpoint
    const currentHash = getSessionTokenHash(req);
    if (currentHash && target.token_hash === currentHash) {
      return NextResponse.json(
        { error: "Cannot revoke your current session via this endpoint" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM user_sessions WHERE id = ${id}`;

    return NextResponse.json({ message: "Session revoked" });
  } catch (error) {
    console.error("[routes-f sessions/:id DELETE]", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
}
