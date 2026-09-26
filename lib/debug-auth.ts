import { NextResponse } from "next/server";

/**
 * Shared secret gate for debug/maintenance endpoints (#1612).
 *
 * Matches debug/clear-users' existing pattern: reads a `secret` query param
 * and compares it against the given env var, failing closed (403) if that
 * env var isn't configured at all rather than allowing unauthenticated
 * access by default.
 */
export function checkDebugSecret(
  req: Request,
  envVarName: string
): NextResponse | null {
  const secret = process.env[envVarName];
  if (!secret) {
    return NextResponse.json(
      { error: `${envVarName} not configured` },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null; // authorized
}
