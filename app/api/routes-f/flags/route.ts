import { getRoutesFFlags } from "@/lib/routes-f/flags";
import { recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { routesFSuccess, routesFError } from "../../routesF/response";

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/flags",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return routesFError("Rate limit exceeded", 429, headers);
  }

  recordMetric("flags");

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || null;

  // Wrap JSON response with apiVersion
  return routesFSuccess(
    {
      flags: getRoutesFFlags(),
      userId,
    },
    200,
    headers
  );
}