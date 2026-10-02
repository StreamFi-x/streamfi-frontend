import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Vercel Cron calls the scheduled path with `Authorization: Bearer
 * $CRON_SECRET`. Fails closed when CRON_SECRET is not configured.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(header);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
