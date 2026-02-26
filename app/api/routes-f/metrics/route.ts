import { NextResponse } from "next/server";
import { getMetricsSnapshot, recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { jsonResponse } from "@/lib/routes-f/version";

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/metrics",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return jsonResponse(
      {
        error: "Rate limit exceeded",
        policy: limiter.policy,
      },
      { status: 429, headers }
    );
  }

  recordMetric("metrics");
  const snapshot = getMetricsSnapshot();
  return jsonResponse(snapshot, { headers });
}
