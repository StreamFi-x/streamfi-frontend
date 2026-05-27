import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session.ok) return session.response;

  try {
    const { rows } = await sql`
      SELECT totp_enabled, updated_at
      FROM user_two_factor
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    const row = rows[0];

    return NextResponse.json({
      enabled: row?.totp_enabled ?? false,
      configuredAt: row?.updated_at ?? null,
    });
  } catch (error) {
    console.error("[routes-f 2fa/status GET]", error);
    return NextResponse.json({ error: "Failed to fetch 2FA status" }, { status: 500 });
  }
}
