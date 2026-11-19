import { NextResponse } from "next/server";
import { checkDebugSecret } from "@/lib/debug-auth";

/**
 * DEV ONLY — reports which required env vars are configured. Guarded by
 * DEBUG_ENV_SECRET, same pattern as debug/clear-users' CLEAR_USERS_SECRET
 * (#1612: this ran completely unauthenticated before).
 *
 * #1768: the LIVEPEER_API_KEY preview this route used to leak is gone; the
 * Livepeer -> Mux migration's library dir, dependency, and env var were
 * already fully removed. Only DB-column retirement tooling that references
 * the old column names on purpose remains (lib/maintenance/livepeer-legacy.ts,
 * scripts/audit-livepeer-legacy.ts, db/migrations/20260925190100_retire_livepeer_columns.sql).
 *
 * GET /api/debug/env?secret=<DEBUG_ENV_SECRET>
 */
export async function GET(req: Request) {
  const forbidden = checkDebugSecret(req, "DEBUG_ENV_SECRET");
  if (forbidden) {
    return forbidden;
  }

  try {
    const envCheck = {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      NODE_ENV: process.env.NODE_ENV,
    };

    return NextResponse.json({
      success: true,
      environment: envCheck,
      message: "Environment check completed",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check environment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
