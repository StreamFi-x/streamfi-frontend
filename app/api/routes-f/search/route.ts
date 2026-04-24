import {
  applyCacheHeaders,
  buildCacheKey,
  getCachedEntry,
  isCacheEnabled,
  setCachedEntry,
} from "@/lib/routes-f/cache";
import { recordMetric } from "@/lib/routes-f/metrics";
import {
  getRecentRoutesFRecords,
  searchRoutesFRecords,
} from "@/lib/routes-f/store";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { routesFSuccess,routesFError } from "../../routesF/response";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/search",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return routesFError("Rate limit exceeded", 429, headers);
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const tag = url.searchParams.get("tag") || "";
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  recordMetric("search");

  const cacheEnabled = isCacheEnabled();
  const cacheKey = buildCacheKey("routes-f/search", {
    q: q || undefined,
    tag: tag || undefined,
    limit: String(limit),
  });

  if (cacheEnabled) {
    const cached = getCachedEntry(cacheKey);
    if (cached) {
      applyCacheHeaders(headers, "HIT", true);
      headers.set("Content-Type", cached.contentType);
      return new Response(cached.body, { status: 200, headers });
    }
  }

  const result =
    q.trim() || tag.trim()
      ? searchRoutesFRecords({ query: q, tag, limit })
      : (() => {
          const recent = getRecentRoutesFRecords(limit);
          return { total: recent.length, items: recent };
        })();

  const body = { total: result.total, items: result.items };

  if (cacheEnabled) {
    setCachedEntry(cacheKey, JSON.stringify(body), "application/json");
    applyCacheHeaders(headers, "MISS", true);
  } else {
    applyCacheHeaders(headers, "MISS", false);
  }

  return routesFSuccess(body, 200, headers);
}