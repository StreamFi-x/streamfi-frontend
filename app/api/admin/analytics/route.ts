import { currentAdminPrivyId, requireAdminSession } from "@/lib/admin-auth";
import { CACHE_POLICIES, cacheHeaders, cached } from "@/lib/cache";
import {
  readFromReplica,
  ReplicaUnavailableError,
  replicaUnavailableResponse,
} from "@/lib/db/replica";
import {
  createRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

// The dashboard polls every 30s (hooks/admin/useAdminAnalytics.ts), i.e. 2/min
// per open tab. 30/min per admin leaves room for several tabs and manual
// refreshes while capping a runaway refresh loop. The COUNT scans themselves
// are bounded by the shared 30s cache below, independent of how many admins
// are looking.
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

// Six COUNT scans, shared by every admin through the 30s cache above. They
// already tolerate 30s of staleness, so they run on the read replica.
async function loadStats(): Promise<AdminAnalyticsStats> {
  const rows = await readFromReplica("admin.analytics.counts", db =>
    db`
    SELECT
      (SELECT COUNT(*) FROM users WHERE is_banned = false)            AS total_users,
      (SELECT COUNT(*) FROM users WHERE is_live = true)               AS live_now,
      (SELECT COUNT(*) FROM stream_reports WHERE status = 'pending')  AS pending_stream_reports,
      (SELECT COUNT(*) FROM bug_reports    WHERE status = 'pending')  AS pending_bug_reports,
      (SELECT COUNT(*) FROM users
        WHERE created_at > now() - INTERVAL '7 days')                AS new_users_7d,
      (SELECT COUNT(*) FROM stream_categories)                        AS total_categories
  `.then(r => r.rows)
  );

  const row = rows[0];
  return {
    totalUsers: Number(row.total_users),
    liveNow: Number(row.live_now),
    pendingStreamReports: Number(row.pending_stream_reports),
    pendingBugReports: Number(row.pending_bug_reports),
    newUsers7d: Number(row.new_users_7d),
    totalCategories: Number(row.total_categories),
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
    if (err instanceof ReplicaUnavailableError) {
      return replicaUnavailableResponse();
    }
    console.error("[admin/analytics] DB error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
