import { checkDebugSecret } from "@/lib/debug-auth";
import { apiInternalError, apiSuccess } from "@/lib/api";
import { createSanitizedErrorResponse } from '@/lib/api/error-response';

/**
 * DEV ONLY — reports which required env vars are configured. Guarded by
 * DEBUG_ENV_SECRET and excluded in production builds (#1612, #1720, #1721).
 *
 * #1721 / #1768: no partial or full API key or secret values are ever included
 * in the response.
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

    return apiSuccess(
      { environment: envCheck },
      { message: "Environment check completed", legacyFlat: true }
    );
  } catch (error) {
    return createSanitizedErrorResponse(error, {
      context: 'debug/env',
      publicMessage: 'Failed to check environment',
    });
  }
}
