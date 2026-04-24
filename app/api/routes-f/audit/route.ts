import { recordMetric } from "@/lib/routes-f/metrics";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { getAuditTrail } from "@/lib/routes-f/store";
import { routesFSuccess, routesFError } from "../../routesF/response";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    const limiter = checkRateLimit({
        headers: req.headers,
        routeKey: "routes-f/audit",
    });

    const headers = new Headers();
    applyRateLimitHeaders(headers, limiter);

    if (!limiter.allowed) {
        headers.set("Retry-After", String(limiter.retryAfterSeconds));

        return routesFError(
            "Rate limit exceeded",
            429,
            headers
        );
    }

    // Parse query parameters
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(Math.max(limitParam, 1), 100);
    const cursor = searchParams.get("cursor") || undefined;

    recordMetric("audit");

    const result = getAuditTrail({ limit, cursor });

    return routesFSuccess(result, 200, headers);
}