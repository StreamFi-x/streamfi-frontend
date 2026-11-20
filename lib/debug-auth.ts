import { NextResponse } from "next/server";
import { apiForbidden } from "@/lib/api";

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
    return apiForbidden(`${envVarName} not configured`);
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== secret) {
    return apiForbidden("Forbidden");
  }

  return null; // authorized
}
