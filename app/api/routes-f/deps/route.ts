import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

type DepStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

interface DependencyResult {
  name: string;
  status: DepStatus;
  latency_ms: number | null;
  detail?: string;
}

const CHECK_TIMEOUT_MS = 3000;

function isAuthorized(req: NextRequest): boolean {
  const internalKey = req.headers.get("x-internal-key");
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (internalKey && expectedKey && internalKey === expectedKey) {
    return true;
  }

  const sessionCookie =
    req.cookies.get("privy_session")?.value ??
    req.cookies.get("wallet_session")?.value;

  return !!sessionCookie;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<
  { result: T; elapsed: number } | { error: string; elapsed: number }
> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), ms)
      ),
    ]);
    return { result, elapsed: Date.now() - start };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      elapsed: Date.now() - start,
    };
  }
}

async function checkPostgres(): Promise<DependencyResult> {
  const outcome = await withTimeout(sql`SELECT 1 AS ok`, CHECK_TIMEOUT_MS);

  if ("error" in outcome) {
    return {
      name: "Vercel Postgres",
      status: outcome.error === "Timeout" ? "degraded" : "unhealthy",
      latency_ms: outcome.elapsed,
      detail: outcome.error,
    };
  }

  return {
    name: "Vercel Postgres",
    status: "healthy",
    latency_ms: outcome.elapsed,
    detail: "Connected",
  };
}

async function checkRedis(): Promise<DependencyResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return {
      name: "Upstash Redis",
      status: "unknown",
      latency_ms: null,
      detail: "Redis credentials not configured",
    };
  }

  const outcome = await withTimeout(
    fetch(`${url}/PING`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json()),
    CHECK_TIMEOUT_MS
  );

  if ("error" in outcome) {
    return {
      name: "Upstash Redis",
      status: outcome.error === "Timeout" ? "degraded" : "unhealthy",
      latency_ms: outcome.elapsed,
      detail: outcome.error,
    };
  }

  return {
    name: "Upstash Redis",
    status: "healthy",
    latency_ms: outcome.elapsed,
  };
}

async function checkMux(): Promise<DependencyResult> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    return {
      name: "Mux",
      status: "unknown",
      latency_ms: null,
      detail: "Mux credentials not configured",
    };
  }

  const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString(
    "base64"
  );

  const outcome = await withTimeout(
    fetch("https://api.mux.com/video/v1/live-streams?limit=1", {
      headers: { Authorization: `Basic ${credentials}` },
    }),
    CHECK_TIMEOUT_MS
  );

  if ("error" in outcome) {
    return {
      name: "Mux",
      status: outcome.error === "Timeout" ? "degraded" : "degraded",
      latency_ms: outcome.elapsed,
      detail: outcome.error,
    };
  }

  const status: DepStatus = outcome.elapsed > 1000 ? "degraded" : "healthy";
  const detail =
    outcome.elapsed > 1000
      ? "API responding but latency elevated"
      : "Connected";

  return {
    name: "Mux",
    status,
    latency_ms: outcome.elapsed,
    detail,
  };
}

async function checkStellarHorizon(): Promise<DependencyResult> {
  const horizonUrl =
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
    "https://horizon-testnet.stellar.org";

  const outcome = await withTimeout(
    fetch(horizonUrl).then(res => res.json()),
    CHECK_TIMEOUT_MS
  );

  if ("error" in outcome) {
    return {
      name: "Stellar Horizon",
      status: outcome.error === "Timeout" ? "degraded" : "degraded",
      latency_ms: outcome.elapsed,
      detail: outcome.error,
    };
  }

  const ledger = (outcome.result as Record<string, unknown>)
    ?.history_latest_ledger;

  return {
    name: "Stellar Horizon",
    status: "healthy",
    latency_ms: outcome.elapsed,
    detail: ledger ? `Latest ledger: ${ledger}` : "Connected",
  };
}

async function checkTransak(): Promise<DependencyResult> {
  const apiKey = process.env.TRANSAK_API_KEY;

  if (!apiKey) {
    return {
      name: "Transak",
      status: "unknown",
      latency_ms: null,
      detail: "API key not configured",
    };
  }

  return {
    name: "Transak",
    status: "healthy",
    latency_ms: 0,
    detail: "API key configured",
  };
}

function computeOverallStatus(deps: DependencyResult[]): DepStatus {
  const criticalNames = new Set(["Vercel Postgres", "Upstash Redis"]);

  const hasUnhealthyCritical = deps.some(
    d => criticalNames.has(d.name) && d.status === "unhealthy"
  );
  if (hasUnhealthyCritical) {
    return "unhealthy";
  }

  const hasDegraded = deps.some(
    d => d.status === "degraded" || d.status === "unhealthy"
  );
  if (hasDegraded) {
    return "degraded";
  }

  return "healthy";
}

/**
 * GET /api/routes-f/deps
 * Dependency health check. Requires X-Internal-Key or admin session.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dependencies = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMux(),
    checkStellarHorizon(),
    checkTransak(),
  ]);

  const overall = computeOverallStatus(dependencies);

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    overall,
    dependencies,
  });
}
