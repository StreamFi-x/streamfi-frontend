import { NextResponse } from "next/server";
import { getMetricsSnapshot, recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/metrics",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        policy: limiter.policy,
      },
      { status: 429, headers }
    );
  }

  recordMetric("metrics");
  const snapshot = getMetricsSnapshot();
  return NextResponse.json(snapshot, { headers });
}
