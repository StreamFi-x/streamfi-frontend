import { NextResponse } from "next/server";
import { runWithCircuitBreaker } from "@/lib/routes-f/circuit-breaker";
import { checkDependencies, getDependencyKeys } from "@/lib/routes-f/deps";
import { withRoutesFLogging } from "@/lib/routes-f/logging";
import { jsonResponse } from "@/lib/routes-f/version";

const CIRCUIT_KEY = "routes-f/deps";

export async function GET(req: Request) {
  return withRoutesFLogging(req, async request => {
    const url = new URL(request.url);
    const failDependencyKey = url.searchParams.get("fail") ?? undefined;

    const result = await runWithCircuitBreaker({
      key: CIRCUIT_KEY,
      action: async () =>
        checkDependencies({
          failDependencyKey,
        }),
    });

    if (result.ok) {
      return jsonResponse(result.value, { status: 200 });
    }

    if (result.shortCircuited) {
      return jsonResponse(
        {
          healthy: false,
          deps: getDependencyKeys().map(key => ({
            key,
            healthy: false,
            latencyMs: 0,
            checkedAt: new Date().toISOString(),
          })),
          error: "Dependency checks are temporarily short-circuited",
          retryAfterSeconds: Math.max(1, Math.ceil(result.retryAfterMs / 1000)),
          circuitState: result.state,
        },
        { status: 503 }
      );
    }

    return jsonResponse(
      {
        healthy: false,
        deps: getDependencyKeys().map(key => ({
          key,
          healthy: false,
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
        })),
        error: "Dependency health check failed",
        retryAfterSeconds: Math.max(1, Math.ceil(result.retryAfterMs / 1000)),
        circuitState: result.state,
      },
      { status: 503 }
    );
  });
}
