import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { apiForbidden } from "@/lib/api";

/**
 * Shared guard for debug/maintenance endpoints (#1612, #1720, #1721).
 *
 * 1. In production deployments (NODE_ENV === "production"), debug endpoints
 *    are disabled entirely and return a standard 404 Not Found response so
 *    they do not expose debug-specific behavior or discovery surface.
 * 2. In non-production environments, reads the `secret` query param and
 *    compares it in constant time against the given env var, failing closed
 *    (403) if that env var isn't configured at all.
 */
export function checkDebugSecret(
  req: Request,
  envVarName: string
): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const secret = process.env[envVarName];
  if (!secret) {
    return apiForbidden(`${envVarName} not configured`);
  }

  const { searchParams } = new URL(req.url);
  const provided = searchParams.get("secret");
  if (!provided) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);
  if (
    secretBuf.length !== providedBuf.length ||
    !timingSafeEqual(secretBuf, providedBuf)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null; // authorized
}
