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
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user
    ON user_sessions (user_id, last_seen DESC)
  `;
}

/** Derive a stable session identifier from the request cookie token. */
function getSessionTokenHash(req: NextRequest): string | null {
  const token =
    req.cookies.get("wallet_session")?.value ??
    req.cookies.get("privy_session")?.value ??
    req.cookies.get("wallet")?.value ??
    null;
  if (!token) {
    return null;
  }
  // Simple deterministic hash — not crypto-sensitive, just for row lookup
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
  }
  return (
    Math.abs(h).toString(16).padStart(8, "0") +
    token.slice(-24).replace(/[^a-zA-Z0-9]/g, "x")
  );
}

/** Parse a rough region string from X-Forwarded-For / CF-IPCountry headers. */
function parseRegion(req: NextRequest): string {
  const country = req.headers.get("cf-ipcountry");
  const region =
    req.headers.get("cf-region") ?? req.headers.get("x-vercel-ip-city");
  if (country && region) {
    return `${country}, ${region}`;
  }
  if (country) {
    return country;
  }
  return "Unknown";
}

/** GET /api/routes-f/sessions — list all active sessions for authenticated user */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureSessionsTable();

    const currentHash = getSessionTokenHash(req);

    const { rows } = await sql`
      SELECT id, device, ip_region, last_seen, created_at
      FROM user_sessions
      WHERE user_id = ${session.userId}
      ORDER BY last_seen DESC
    `;

    const sessions = rows.map((row: Record<string, unknown>) => ({
      ...row,
      is_current: currentHash ? row.token_hash === currentHash : false,
    }));

    // Upsert current session so it appears in the list
    if (currentHash) {
      const device = req.headers.get("user-agent")?.slice(0, 200) ?? "Unknown";
      const ip_region = parseRegion(req);
      await sql`
        INSERT INTO user_sessions (user_id, token_hash, device, ip_region, last_seen)
        VALUES (${session.userId}, ${currentHash}, ${device}, ${ip_region}, now())
        ON CONFLICT (token_hash) DO UPDATE
          SET last_seen = now(), ip_region = EXCLUDED.ip_region
      `;
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[routes-f sessions GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
