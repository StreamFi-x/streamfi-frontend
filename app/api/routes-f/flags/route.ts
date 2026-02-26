import { NextResponse } from "next/server";
import { getRoutesFFlags } from "@/lib/routes-f/flags";
import { recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { jsonResponse } from "@/lib/routes-f/version";

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/flags",
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

  recordMetric("flags");
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || null;

  return jsonResponse(
    {
      flags: getRoutesFFlags(),
      userId,
    },
    { headers }
  );
}
