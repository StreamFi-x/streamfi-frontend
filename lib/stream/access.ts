import { sql } from "@vercel/postgres";

export type StreamAccessReason = "password" | "subscription";

export type AccessResult =
  | { allowed: true }
  | { allowed: false; reason: StreamAccessReason };

export async function checkSubscriptionAccess(
  streamerId: string,
  viewerPublicKey: string | null
): Promise<AccessResult> {
  if (!viewerPublicKey) {
    return { allowed: false, reason: "subscription" };
  }

  const { rows } = await sql`
    SELECT id FROM subscriptions
    WHERE streamer_id = ${streamerId}
      AND subscriber_id = (
        SELECT id FROM users WHERE LOWER(wallet) = LOWER(${viewerPublicKey})
      )
      AND status = 'active'
      AND current_period_end > now()
    LIMIT 1
  `;

  return rows.length > 0
    ? { allowed: true }
    : { allowed: false, reason: "subscription" };
}
