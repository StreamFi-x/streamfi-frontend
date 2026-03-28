import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

/**
 * GET /api/routes-f/creator/dashboard
 * Returns a summary of key stats for the authenticated creator.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    const userId = session.userId;

    try {
        // Parallel queries for all dashboard metrics
        const [
            followerResult,
            earningsResult,
            streamsMonthResult,
            avgViewersResult,
            subscriberResult,
        ] = await Promise.all([
            // 1. Follower Count
            sql`SELECT COUNT(*)::int AS count FROM user_follows WHERE followee_id = ${userId}`,

            // 2. Total Earnings (USDC) from gift_transactions
            sql`SELECT COALESCE(SUM(amount_usdc), 0)::numeric(20,2)::text AS total FROM gift_transactions WHERE creator_id = ${userId}`,

            // 3. Streams This Month (Count of sessions started in current month)
            sql`SELECT COUNT(*)::int AS count FROM stream_sessions WHERE user_id = ${userId} AND started_at >= date_trunc('month', now())`,

            // 4. Avg Viewer Count (Average of peak_viewers across all sessions)
            sql`SELECT COALESCE(AVG(peak_viewers), 0)::float AS avg FROM stream_sessions WHERE user_id = ${userId}`,

            // 5. Subscriber Count (Active subscriptions)
            sql`SELECT COUNT(*)::int AS count FROM subscriptions WHERE creator_id = ${userId} AND status = 'active' AND expires_at > NOW()`,
        ]);

        const dashboardData = {
            follower_count: followerResult.rows[0]?.count ?? 0,
            total_earnings: earningsResult.rows[0]?.total ?? "0.00",
            streams_this_month: streamsMonthResult.rows[0]?.count ?? 0,
            avg_viewer_count: Math.round((avgViewersResult.rows[0]?.avg ?? 0) * 100) / 100,
            subscriber_count: subscriberResult.rows[0]?.count ?? 0,
            pending_payouts: "0.00", // Placeholder until payout logic is implemented
            generated_at: new Date().toISOString(),
        };

        return NextResponse.json(dashboardData, {
            headers: {
                "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
            },
        });
    } catch (error) {
        console.error("[creator dashboard] GET error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
