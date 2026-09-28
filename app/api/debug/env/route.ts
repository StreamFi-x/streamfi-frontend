import { NextResponse } from "next/server";
import { checkDebugSecret } from "@/lib/debug-auth";

/**
 * DEV ONLY — reports which required env vars are configured. Guarded by
 * DEBUG_ENV_SECRET, same pattern as debug/clear-users' CLEAR_USERS_SECRET
 * (#1612: this ran completely unauthenticated before).
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
