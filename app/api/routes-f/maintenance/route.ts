import { NextResponse } from "next/server";
import {
  createMaintenanceWindow,
  getMaintenanceWindows,
} from "@/lib/routes-f/store";
import { recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { jsonResponse } from "@/lib/routes-f/version";

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/maintenance",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return jsonResponse(
      { error: "Rate limit exceeded", policy: limiter.policy },
      { status: 429, headers }
    );
  }

  recordMetric("maintenance");
  const windows = getMaintenanceWindows();
  return jsonResponse({ windows }, { headers });
}

export async function POST(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/maintenance",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return jsonResponse(
      { error: "Rate limit exceeded", policy: limiter.policy },
      { status: 429, headers }
    );
  }

  let payload: { start?: string; end?: string; reason?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(
      { error: "Invalid JSON payload" },
      { status: 400, headers }
    );
  }

  if (!payload.start || !payload.end) {
    return jsonResponse(
      { error: "start and end are required" },
      { status: 400, headers }
    );
  }

  try {
    const window = createMaintenanceWindow({
      start: payload.start,
      end: payload.end,
      reason: payload.reason,
    });
    recordMetric("maintenance");
    return jsonResponse({ window }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "overlap") {
        return jsonResponse(
          { error: "Maintenance window overlaps existing window" },
          { status: 409, headers }
        );
      }
      if (error.message === "invalid-time") {
        return jsonResponse(
          { error: "start and end must be valid ISO timestamps" },
          { status: 400, headers }
        );
      }
      if (error.message === "invalid-range") {
        return jsonResponse(
          { error: "start must be before end" },
          { status: 400, headers }
        );
      }
    }
  }

  return jsonResponse(
    { error: "Failed to create maintenance window" },
    { status: 500, headers }
  );
}
