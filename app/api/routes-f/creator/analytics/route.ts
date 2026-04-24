import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import {
  subDays,
  startOfDay,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  isSameDay,
  isSameWeek,
  parseISO,
} from "date-fns";

export const dynamic = "force-dynamic";

type Metric = "revenue" | "viewers" | "followers" | "tips";
type Period = "7d" | "30d" | "90d";
type Granularity = "day" | "week";

/**
 * Converts a Stellar amount string to a BigInt of stroops (10^7)
 * to prevent float precision loss.
 */
function toStroops(amount: string): bigint {
  try {
    const [whole, fraction = ""] = amount.split(".");
    const paddedFraction = fraction.padEnd(7, "0").slice(0, 7);
    return BigInt(whole + paddedFraction);
  } catch {
    return BigInt(0);
  }
}

/**
 * Converts stroops back to a string with 7 decimal places.
 */
function fromStroops(stroops: bigint): string {
  const s = stroops.toString().padStart(8, "0");
  const whole = s.slice(0, -7);
  const fraction = s.slice(-7);
  return `${whole}.${fraction}`;
}

export async function GET(req: NextRequest) {
  // 1. Authenticate creator
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { userId } = session;

  // 2. Parse and validate query parameters
  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") as Metric;
  const period = (searchParams.get("period") || "7d") as Period;
  const granularity = (searchParams.get("granularity") || "day") as Granularity;

  if (!["revenue", "viewers", "followers", "tips"].includes(metric)) {
    return NextResponse.json(
      { error: "Invalid metric. Must be one of: revenue, viewers, followers, tips" },
      { status: 400 }
    );
  }

  if (!["7d", "30d", "90d"].includes(period)) {
    return NextResponse.json(
      { error: "Invalid period. Must be one of: 7d, 30d, 90d" },
      { status: 400 }
    );
  }

  if (!["day", "week"].includes(granularity)) {
    return NextResponse.json(
      { error: "Invalid granularity. Must be one of: day, week" },
      { status: 400 }
    );
  }

  try {
    // 3. Define time range
    const now = new Date();
    const daysToSub = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const startDate = startOfDay(subDays(now, daysToSub));
    const endDate = now;

    // Generate date range points
    const datePoints =
      granularity === "day"
        ? eachDayOfInterval({ start: startDate, end: endDate })
        : eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });

    let data: { date: string; value: string | number }[] = [];

    if (metric === "viewers") {
      // Fetch viewer analytics from DB
      // We use a subquery to handle the date_trunc safely
      const { rows } = await sql`
        SELECT 
          date_trunc(${granularity}, sv.joined_at) as point_date,
          COUNT(DISTINCT sv.user_id) as viewer_count
        FROM stream_viewers sv
        JOIN stream_sessions ss ON sv.stream_session_id = ss.id
        WHERE ss.user_id = ${userId}
          AND sv.joined_at >= ${startDate.toISOString()}
        GROUP BY point_date
        ORDER BY point_date ASC
      `;

      data = datePoints.map(point => {
        const match = rows.find(r => 
          granularity === "day" 
            ? isSameDay(new Date(r.point_date), point)
            : isSameWeek(new Date(r.point_date), point, { weekStartsOn: 1 })
        );
        return {
          date: format(point, "yyyy-MM-dd"),
          value: match ? Number(match.viewer_count) : 0
        };
      });

    } else if (metric === "revenue" || metric === "tips") {
      // Fetch creator's Stellar public key (stored in 'wallet' column)
      const userRes = await sql`SELECT wallet FROM users WHERE id = ${userId}`;
      const publicKey = userRes.rows[0]?.wallet;

      if (!publicKey || !publicKey.startsWith("G")) {
        data = datePoints.map(point => ({ date: format(point, "yyyy-MM-dd"), value: "0.0000000" }));
      } else {
        // Fetch tips from Stellar
        const { tips } = await fetchPaymentsReceived({
          publicKey,
          limit: 200, 
        });

        // Group tips by date
        data = datePoints.map(point => {
          const dailyTips = tips.filter(tip => {
            const tipDate = parseISO(tip.timestamp);
            return granularity === "day" 
              ? isSameDay(tipDate, point)
              : isSameWeek(tipDate, point, { weekStartsOn: 1 });
          });

          const totalStroops = dailyTips.reduce((sum, tip) => sum + toStroops(tip.amount), BigInt(0));
          return {
            date: format(point, "yyyy-MM-dd"),
            value: fromStroops(totalStroops)
          };
        });
      }

    } else if (metric === "followers") {
      // Fetch current follower count
      const { rows } = await sql`
        SELECT array_length(followers, 1) as follower_count 
        FROM users 
        WHERE id = ${userId}
      `;
      const currentCount = Number(rows[0]?.follower_count || 0);

      // Baseline implementation for followers history (current count for all points)
      data = datePoints.map(point => ({
        date: format(point, "yyyy-MM-dd"),
        value: currentCount
      }));
    }

    // 4. Return response with caching headers
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    });

  } catch (error) {
    console.error("[creator/analytics] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
