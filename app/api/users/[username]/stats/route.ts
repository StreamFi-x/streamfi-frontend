import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  CACHE_POLICIES,
  cacheHeaders,
  cacheKey,
  cacheTags,
  cached,
} from "@/lib/cache";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const normalizedUsername = username.toLowerCase();

    // Looked up by username OR wallet, so tagged by both; refresh-total and
    // the Stellar payment webhook invalidate them after updating totals.
    const stats = await cached(
      {
        key: cacheKey("user-tip-stats", normalizedUsername, username),
        tags: [
          cacheTags.userByName(normalizedUsername),
          cacheTags.userByWallet(username),
        ],
        ttlSeconds: CACHE_POLICIES.publicProfile.appTtlSeconds,
      },
      async () => {
        const result = await sql`
          SELECT
            total_tips_received,
            total_tips_count,
            last_tip_at,
            wallet as stellar_public_key
          FROM users
          WHERE LOWER(username) = ${normalizedUsername} OR wallet = ${username}
        `;
        return result.rows[0] ?? null;
      }
    );

    // If user doesn't exist in DB but has a valid Stellar public key,
    // return empty stats instead of 404 to allow the UI to render.
    if (!stats) {
      const isStellarAddress =
        username.startsWith("G") && username.length === 56;

      if (isStellarAddress) {
        return NextResponse.json({
          totalReceived: "0.0000000",
          totalCount: 0,
          lastTipAt: null,
          stellarPublicKey: username,
        });
      }

      return NextResponse.json(
        { error: "User stats not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        totalReceived: stats.total_tips_received || "0.0000000",
        totalCount: parseInt(stats.total_tips_count || "0"),
        lastTipAt: stats.last_tip_at,
        stellarPublicKey: stats.stellar_public_key,
      },
      { headers: cacheHeaders("publicProfile") }
    );
  } catch (error) {
    console.error("API: Fetch user stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user stats" },
      { status: 500 }
    );
  }
}
