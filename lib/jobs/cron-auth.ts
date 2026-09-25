import { timingSafeEqual } from "crypto";

/**
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Jobs refuse to run
 * when CRON_SECRET is not configured so an unset variable can never expose
 * them publicly.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
