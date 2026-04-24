import {
  createMaintenanceWindow,
  getMaintenanceWindows,
} from "@/lib/routes-f/store";
import { recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { routesFSuccess, routesFError } from "../../routesF/response";

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/maintenance",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return routesFError("Rate limit exceeded", 429, headers);
  }

  recordMetric("maintenance");

  const windows = getMaintenanceWindows();

  return routesFSuccess({ windows }, 200, headers);
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
    return routesFError("Rate limit exceeded", 429, headers);
  }

  let payload: { start?: string; end?: string; reason?: string };
  try {
    payload = await req.json();
  } catch {
    return routesFError("Invalid JSON payload", 400, headers);
  }

  if (!payload.start || !payload.end) {
    return routesFError("start and end are required", 400, headers);
  }

  try {
    const window = createMaintenanceWindow({
      start: payload.start,
      end: payload.end,
      reason: payload.reason,
    });

    recordMetric("maintenance");

    return routesFSuccess({ window }, 201, headers);
  } catch (error: any) {
    if (error.message === "overlap") {
      return routesFError("Maintenance window overlaps existing window", 409, headers);
    }
    if (error.message === "invalid-time") {
      return routesFError("start and end must be valid ISO timestamps", 400, headers);
    }
    if (error.message === "invalid-range") {
      return routesFError("start must be before end", 400, headers);
    }
  }

  return routesFError("Failed to create maintenance window", 500, headers);
}