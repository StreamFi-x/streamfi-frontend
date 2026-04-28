import { sql } from "@vercel/postgres";
import { writeNotification } from "@/lib/notifications";

export const BADGE_DEFINITIONS = [
  {
    id: "first_stream",
    name: "First Broadcast",
    description: "Completed first live stream",
    icon: "broadcast",
    tier: "bronze",
    sort_order: 1,
  },
  {
    id: "first_tip",
    name: "First Tip",
    description: "Received first XLM tip",
    icon: "tip",
    tier: "bronze",
    sort_order: 2,
  },
  {
    id: "first_gift",
    name: "Gift Received",
    description: "Received first Dragon or Lion gift",
    icon: "gift",
    tier: "silver",
    sort_order: 3,
  },
  {
    id: "hundred_followers",
    name: "Rising Star",
    description: "Reached 100 followers",
    icon: "followers",
    tier: "silver",
    sort_order: 4,
  },
  {
    id: "thousand_followers",
    name: "Community Builder",
    description: "Reached 1,000 followers",
    icon: "community",
    tier: "gold",
    sort_order: 5,
  },
  {
    id: "ten_hours_streamed",
    name: "Marathon Streamer",
    description: "Streamed for 10 hours total",
    icon: "clock-10",
    tier: "silver",
    sort_order: 6,
  },
  {
    id: "hundred_hours_streamed",
    name: "Veteran Broadcaster",
    description: "Streamed for 100 hours total",
    icon: "clock-100",
    tier: "gold",
    sort_order: 7,
  },
  {
    id: "top_earner",
    name: "Top Earner",
    description: "Earned 1,000 USDC total",
    icon: "diamond",
    tier: "diamond",
    sort_order: 8,
  },
] as const;

export type BadgeStatSnapshot = {
  totalStreams: number;
  totalTipCount: number;
  totalGiftCount: number;
  followerCount: number;
  totalStreamedSeconds: number;
  totalEarningsUsdc: number;
};

export function evaluateBadgeIds(
  stats: BadgeStatSnapshot,
  earnedBadgeIds: Set<string>
): string[] {
  const newBadges: string[] = [];

  const maybeAdd = (badgeId: string, condition: boolean) => {
    if (condition && !earnedBadgeIds.has(badgeId)) {
      newBadges.push(badgeId);
    }
  };

  maybeAdd("first_stream", stats.totalStreams > 0);
  maybeAdd("first_tip", stats.totalTipCount > 0);
  maybeAdd("first_gift", stats.totalGiftCount > 0);
  maybeAdd("hundred_followers", stats.followerCount >= 100);
  maybeAdd("thousand_followers", stats.followerCount >= 1000);
  maybeAdd("ten_hours_streamed", stats.totalStreamedSeconds >= 10 * 60 * 60);
  maybeAdd(
    "hundred_hours_streamed",
    stats.totalStreamedSeconds >= 100 * 60 * 60
  );
  maybeAdd("top_earner", stats.totalEarningsUsdc >= 1000);

  return newBadges;
}

export async function getBadgeStats(
  userId: string
): Promise<BadgeStatSnapshot> {
  const [streamRows, tipRows, giftRows, followRows, earningsRows] =
    await Promise.all([
      sql`
      SELECT COUNT(*) AS total_streams,
             COALESCE(SUM(COALESCE(duration_seconds, 0)), 0) AS total_streamed_seconds
      FROM stream_sessions
      WHERE user_id = ${userId}
        AND ended_at IS NOT NULL
    `,
      sql`
      SELECT COUNT(*) AS total_tip_count
      FROM tip_transactions
      WHERE creator_id = ${userId}
    `,
      sql`
      SELECT COUNT(*) AS total_gift_count
      FROM gift_transactions
      WHERE creator_id = ${userId}
    `,
      sql`
      SELECT COUNT(*) AS follower_count
      FROM user_follows
      WHERE followee_id = ${userId}
    `,
      sql`
      SELECT (
        COALESCE((SELECT SUM(amount_usdc) FROM gift_transactions WHERE creator_id = ${userId}), 0) +
        COALESCE((SELECT SUM(amount_usdc) FROM subscriptions WHERE creator_id = ${userId} AND status IN ('active', 'completed', 'cancelled')), 0)
      ) AS usdc_earnings
    `,
    ]);

  const xlmRows = await sql`
    SELECT COALESCE(SUM(amount_xlm), 0) AS total_tip_xlm
    FROM tip_transactions
    WHERE creator_id = ${userId}
  `;

  const xlmPriceRows = await sql`
    SELECT price_usd
    FROM tip_transactions
    WHERE creator_id = ${userId}
      AND price_usd IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const latestXlmPrice = Number.parseFloat(
    String(xlmPriceRows.rows[0]?.price_usd ?? 0.08)
  );

  const xlmEarnings =
    Number.parseFloat(String(xlmRows.rows[0]?.total_tip_xlm ?? 0)) *
    latestXlmPrice;

  return {
    totalStreams: Number.parseInt(
      String(streamRows.rows[0]?.total_streams ?? 0),
      10
    ),
    totalTipCount: Number.parseInt(
      String(tipRows.rows[0]?.total_tip_count ?? 0),
      10
    ),
    totalGiftCount: Number.parseInt(
      String(giftRows.rows[0]?.total_gift_count ?? 0),
      10
    ),
    followerCount: Number.parseInt(
      String(followRows.rows[0]?.follower_count ?? 0),
      10
    ),
    totalStreamedSeconds: Number.parseInt(
      String(streamRows.rows[0]?.total_streamed_seconds ?? 0),
      10
    ),
    totalEarningsUsdc:
      Number.parseFloat(String(earningsRows.rows[0]?.usdc_earnings ?? 0)) +
      xlmEarnings,
  };
}

export async function evaluateAndAwardBadges(userId: string) {
  const [stats, earnedRows] = await Promise.all([
    getBadgeStats(userId),
    sql`
      SELECT badge_id FROM user_badges WHERE user_id = ${userId}
    `,
  ]);

  const earnedBadgeIds = new Set(
    earnedRows.rows.map(row => String(row.badge_id))
  );
  const newBadges = evaluateBadgeIds(stats, earnedBadgeIds);

  if (newBadges.length === 0) {
    return [];
  }

  await Promise.all(
    newBadges.map(
      badgeId =>
        sql`
        INSERT INTO user_badges (user_id, badge_id)
        VALUES (${userId}, ${badgeId})
        ON CONFLICT DO NOTHING
      `
    )
  );

  const userRow =
    await sql`SELECT username FROM users WHERE id = ${userId} LIMIT 1`;
  const username = String(userRow.rows[0]?.username ?? "creator");

  await Promise.all(
    newBadges.map(async badgeId => {
      const definition = BADGE_DEFINITIONS.find(badge => badge.id === badgeId);
      if (!definition) {
        return;
      }

      await writeNotification(
        userId,
        "live",
        `Badge earned: ${definition.name}`,
        `${username} unlocked the ${definition.name} badge`
      );
    })
  );

  return newBadges;
}
