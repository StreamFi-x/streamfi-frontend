import { currentAdminPrivyId, requireAdminSession } from "@/lib/admin-auth";
import { CACHE_POLICIES, cacheHeaders, cached } from "@/lib/cache";
import {
  createRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";
import { getCurrentAdminAnalytics } from "@/lib/analytics/admin-analytics-rollup";

// The dashboard polls every 30s (hooks/admin/useAdminAnalytics.ts), i.e. 2/min
// per open tab. 30/min per admin leaves room for several tabs and manual
// refreshes while capping a runaway refresh loop. The metrics are served from
// a materialized rollup, so no expensive COUNT(*) queries are run per request.
const adminAnalyticsLimit = createRateLimit({
  namespace: "admin-analytics",
  limit: 30,
  windowMs: 60_000,
});

interface AdminAnalyticsStats {
  totalUsers: number;
  liveNow: number;
  pendingStreamReports: number;
  pendingBugReports: number;
  newUsers7d: number;
  totalCategories: number;
}

async function loadStats(): Promise<AdminAnalyticsStats> {
  // Use materialized rollup instead of live COUNT(*) queries (#1373)
  const snapshot = await getCurrentAdminAnalytics();

  return {
    totalUsers: snapshot.totalUsersActive,
    liveNow: snapshot.liveStreamsCount,
    pendingStreamReports: snapshot.pendingStreamReports,
    pendingBugReports: snapshot.pendingBugReports,
    newUsers7d: snapshot.newUsersCount,
    totalCategories: snapshot.totalCategories,
  };
}

export async function GET(): Promise<Response> {
  // Brute-force guard first (401/429/503); the per-admin limit below caps
  // what an authenticated admin can do.
  const adminDenied = await requireAdminSession("admin/analytics");
  if (adminDenied) {
    return adminDenied;
  }

  const limit = await adminAnalyticsLimit.check(await currentAdminPrivyId());
  if (!limit.success) {
    return tooManyRequests(limit);
  }

  try {
    const stats = await cached(
      {
        key: "admin:analytics",
        ttlSeconds: CACHE_POLICIES.adminAggregate.appTtlSeconds,
      },
      loadStats
    );
    return Response.json(stats, {
      headers: {
        ...cacheHeaders("adminAggregate"),
        ...rateLimitHeaders(limit),
      },
    });
  } catch (err) {
    console.error("[admin/analytics] DB error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
