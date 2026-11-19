import { timingSafeEqual } from "crypto";

/**
 * Vercel Cron authentication: Vercel sends `Authorization: Bearer
 * <CRON_SECRET>` on scheduled invocations. Compared in constant time; an
 * unset CRON_SECRET never authorizes.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
