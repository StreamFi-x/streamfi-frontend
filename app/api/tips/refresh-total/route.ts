import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getAccountTipStats } from "@/lib/stellar/horizon";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        // 1. Get user's wallet address from database
        const userResult = await sql`
            SELECT wallet FROM users WHERE LOWER(username) = ${username.toLowerCase()}
        `;

        const user = userResult.rows[0];
        if (!user || !user.wallet) {
            return NextResponse.json({ error: "User or wallet not found" }, { status: 404 });
        }

        const wallet = user.wallet;

        // 2. Fetch live stats from Stellar blockchain
        // Note: For now we fetch last 200 payments. In prod, use an indexer or paging tokens.
        const liveStats = await getAccountTipStats(wallet);

        // 3. Update database with fresh totals
        await sql`
            UPDATE users 
            SET total_tips_received = ${liveStats.totalTipsReceived},
                total_tips_count = ${liveStats.totalTipsCount},
                last_tip_at = ${liveStats.lastTipAt}
            WHERE LOWER(username) = ${username.toLowerCase()}
        `;

        return NextResponse.json({
            success: true,
            message: "Tip total refreshed from blockchain",
            stats: {
                totalReceived: liveStats.totalTipsReceived,
                totalCount: liveStats.totalTipsCount,
                lastTipAt: liveStats.lastTipAt
            }
        });
    } catch (error) {
        console.error("API: Refresh tips error:", error);
        return NextResponse.json(
            { error: "Failed to refresh tips from blockchain" },
            { status: 500 }
        );
    }
}
