/**
 * Best-effort client IP for security decisions.
 *
 * On Vercel, `x-real-ip` and `x-forwarded-for` are set by the edge network
 * and overwritten on inbound requests, so clients cannot spoof them. Behind
 * any other proxy the first X-Forwarded-For hop is attacker-controlled, which
 * is why the admin throttle never relies on the IP alone (it also tracks the
 * presented credential and a global failure counter).
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
