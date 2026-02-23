import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;
        const normalizedUsername = username.toLowerCase();

        // The requirements specify these exact column names: 
        // total_tips_received, total_tips_count, last_tip_at, stellar_public_key
        const result = await sql`
      SELECT 
        total_tips_received, 
        total_tips_count, 
        last_tip_at, 
        wallet as stellar_public_key 
      FROM users 
      WHERE LOWER(username) = ${normalizedUsername}
    `;

        const stats = result.rows[0];

        if (!stats) {
            return NextResponse.json({ error: "User stats not found" }, { status: 404 });
        }

        return NextResponse.json({
            totalReceived: stats.total_tips_received || "0.0000000",
            totalCount: parseInt(stats.total_tips_count || "0"),
            lastTipAt: stats.last_tip_at,
            stellarPublicKey: stats.stellar_public_key,
        });
    } catch (error) {
        console.error("API: Fetch user stats error:", error);
        return NextResponse.json(
            { error: "Failed to fetch user stats" },
            { status: 500 }
        );
    }
}
