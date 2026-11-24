import { NextRequest, NextResponse } from "next/server";
import { checkSystemHealth, verifyHealthCheckAuth } from "@/lib/health/check";
import { logger } from "@/lib/tracing/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Reports independent connectivity status for the application's core
 * dependencies: database (PostgreSQL), Redis (Upstash), Mux Video API,
 * and Stellar Horizon.
 *
 * Authentication:
 * - When HEALTH_CHECK_SECRET is configured, callers must supply either
 *   `Authorization: Bearer <HEALTH_CHECK_SECRET>` or
 *   `x-health-secret: <HEALTH_CHECK_SECRET>`.
 * - When HEALTH_CHECK_SECRET is not configured, the endpoint is accessible
 *   to external monitoring probes.
 *
 * HTTP Status:
 * - 200: All checked dependencies are healthy.
 * - 503: One or more dependencies are down or degraded.
 * - 401: Unauthorized (when HEALTH_CHECK_SECRET is configured and missing/invalid).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = verifyHealthCheckAuth(req);
  if (!auth.authorized) {
    logger.warn("Unauthorized health check request", {
      route: "GET /api/health",
    });
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  }

  try {
    const report = await checkSystemHealth();
    const httpStatus = report.status === "healthy" ? 200 : 503;

    if (httpStatus !== 200) {
      logger.warn("System health check reported degraded or unhealthy status", {
        route: "GET /api/health",
        status: report.status,
        db: report.dependencies.database.status,
        redis: report.dependencies.redis.status,
        mux: report.dependencies.mux.status,
        stellarHorizon: report.dependencies.stellarHorizon.status,
      });
    }

    return NextResponse.json(report, {
      status: httpStatus,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    logger.error("Unexpected failure in health check endpoint", error, {
      route: "GET /api/health",
    });
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check execution failed",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  }
}
