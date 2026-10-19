import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { runDiagnostics } from "@/lib/diagnostics/service";
import { generateGuidance } from "@/lib/diagnostics/guidance-generator";
import { EncoderSettings, DiagnosticResponse } from "@/lib/diagnostics/types";
import { logger } from "@/lib/tracing/logger";
import { z } from "zod";

// Validation schema
const EncoderSettingsSchema = z.object({
  bitrate: z.number().int().positive("Bitrate must be positive").max(100000, "Bitrate too high"),
  resolution: z.string().regex(/^\d+x\d+$/, "Resolution must be in format WIDTHxHEIGHT"),
  keyframeIntervalMs: z.number().int().positive("Keyframe interval must be positive"),
});

const RequestBodySchema = z.object({
  encoderSettings: EncoderSettingsSchema,
});

// Rate limiting: track diagnostics per user per time window
// Note: This uses in-memory state which does not persist across server restarts or
// instances in a multi-instance deployment. For production, implement with Redis or
// a distributed cache. Current approach is suitable for development and single-instance
// deployments.
// TODO: Move to Redis-backed rate limiting for production scaling
const diagnosticsRateLimiter = new Map<string, { count: number; resetTime: number }>();

// Periodic cleanup of expired rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of diagnosticsRateLimiter.entries()) {
    if (now > value.resetTime + 60000) { // Clean up entries 1 minute after expiry
      diagnosticsRateLimiter.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug("Rate limiter cleanup", { entriesCleaned: cleaned });
  }
}, 5 * 60 * 1000);

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const key = userId;
  const limit = diagnosticsRateLimiter.get(key);

  // 1 diagnostic per minute per user
  const WINDOW_MS = 60000;
  const MAX_PER_WINDOW = 1;

  if (!limit || now > limit.resetTime) {
    diagnosticsRateLimiter.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }

  if (limit.count >= MAX_PER_WINDOW) {
    return false;
  }

  limit.count++;
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse<DiagnosticResponse>> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const parsed = RequestBodySchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Invalid diagnostics request", {
        userId: session.userId,
        errors: parsed.error.errors,
      });

      return NextResponse.json(
        {
          success: false,
          results: null,
          guidance: [
            {
              message: "Invalid encoder settings. Check bitrate, resolution, and keyframe interval.",
              severity: "error",
            },
          ],
          summary: "Invalid request",
          timestamp: new Date().toISOString(),
        } as DiagnosticResponse,
        { status: 400 }
      );
    }

    const encoderSettings: EncoderSettings = parsed.data.encoderSettings;

    // Check rate limit
    if (!checkRateLimit(session.userId)) {
      logger.warn("Diagnostics rate limit exceeded", { userId: session.userId });

      return NextResponse.json(
        {
          success: false,
          results: null,
          guidance: [
            {
              message: "Please wait before running diagnostics again. Limited to 1 per minute.",
              severity: "warning",
            },
          ],
          summary: "Rate limited",
          timestamp: new Date().toISOString(),
        } as DiagnosticResponse,
        { status: 429 }
      );
    }

    logger.info("Running diagnostics", {
      userId: session.userId,
      encoderSettings,
    });

    // Run diagnostics
    const results = await runDiagnostics(encoderSettings, session.userId);

    // Generate guidance
    const { guidance, summary } = generateGuidance(results);

    const response: DiagnosticResponse = {
      success: true,
      results,
      guidance,
      summary,
      timestamp: new Date().toISOString(),
    };

    logger.info("Diagnostics complete", {
      userId: session.userId,
      health: results.health.status,
      confidence: results.health.confidence,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error("Diagnostics API error", {
      userId: session.userId,
      error: String(error),
    });

    // Return graceful error response (never throw 500)
    const response: DiagnosticResponse = {
      success: false,
      results: null,
      guidance: [
        {
          message: "Diagnostics service is temporarily unavailable. You can still go live.",
          severity: "warning",
        },
      ],
      summary: "Service unavailable",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  }
}
