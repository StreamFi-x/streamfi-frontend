import { sql } from "@vercel/postgres";
import {
  CACHE_POLICIES,
  cacheHeaders,
  cacheKey,
  cacheTags,
  cached,
} from "@/lib/cache";
import { apiInternalError, apiNotFound, apiSuccess } from "@/lib/api";

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
          WHERE (LOWER(username) = ${normalizedUsername} OR wallet = ${username})
            AND deleted_at IS NULL
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
        return apiSuccess(
          {
            totalReceived: "0.0000000",
            totalCount: 0,
            lastTipAt: null,
            stellarPublicKey: username,
          },
          { legacyFlat: true }
        );
      }

      return apiNotFound("User stats not found");
    }

    return apiSuccess(
      {
        totalReceived: stats.total_tips_received || "0.0000000",
        totalCount: parseInt(stats.total_tips_count || "0", 10),
        lastTipAt: stats.last_tip_at,
        stellarPublicKey: stats.stellar_public_key,
      },
      { headers: cacheHeaders("publicProfile"), legacyFlat: true }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("API: Fetch user stats error:", error);
    return apiInternalError("Failed to fetch user stats");
  }
}
