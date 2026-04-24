import { getMetricsSnapshot, recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { routesFSuccess, routesFError } from "../../routesF/response";

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/metrics",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return routesFError("Rate limit exceeded", 429, headers);
  }

  recordMetric("metrics");

  const snapshot = getMetricsSnapshot();

  return routesFSuccess(snapshot, 200, headers);
}