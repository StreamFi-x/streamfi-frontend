/**
 * Cron Job: Close Inactive Stream Sessions
 * 
 * POST /api/routes-f/cron-close-inactive-sessions
 * 
 * Closes stream_session rows for sessions with no ingest for 15+ minutes.
 * This handles edge cases where the Mux webhook didn't fire or was missed.
 * 
 * Security:
 * - Requires admin authentication OR internal API secret
 * - Rate limited to prevent abuse
 * 
 * Cron setup (Vercel):
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/routes-f/cron-close-inactive-sessions",
 *     "schedule": "*/5 * * * *"  // Every 5 minutes
 *   }]
 * }
 * 
 * Or use external cron service (e.g., cron-job.org, EasyCron) with:
 * - URL: https://yourdomain.com/api/routes-f/cron-close-inactive-sessions
 * - Method: POST
 * - Header: x-internal-secret: YOUR_INTERNAL_API_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession } from "@/lib/admin-auth";
import { createRateLimiter } from "@/lib/rate-limit";

// Rate limiter: max 12 requests per hour (every 5 minutes)
const isRateLimited = createRateLimiter(60 * 60 * 1000, 12);

// Inactivity threshold in minutes
const INACTIVITY_THRESHOLD_MINUTES = 15;

/**
 * Verify the request is authorized via admin session or internal secret
 */
async function verifyAuthorization(req: NextRequest): Promise<boolean> {
  // Check for admin session
  const isAdmin = await verifyAdminSession();
  if (isAdmin) {
    return true;
  }

  // Check for internal API secret (for cron services)
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    console.warn("⚠️ INTERNAL_API_SECRET not configured - cron endpoint requires admin session");
    return false;
  }

  const providedSecret = req.headers.get("x-internal-secret");
  return providedSecret === internalSecret;
}

/**
 * Check Mux stream status to verify if stream is actually inactive
 */
async function verifyStreamInactive(muxStreamId: string): Promise<boolean> {
  try {
    const muxTokenId = process.env.MUX_TOKEN_ID;
    const muxTokenSecret = process.env.MUX_TOKEN_SECRET;

    if (!muxTokenId || !muxTokenSecret) {
      console.warn("⚠️ Mux credentials not configured - skipping stream verification");
      return true; // Assume inactive if we can't verify
    }

    const auth = Buffer.from(`${muxTokenId}:${muxTokenSecret}`).toString("base64");
    const response = await fetch(
      `https://api.mux.com/video/v1/live-streams/${muxStreamId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch Mux stream status: ${response.status}`);
      return true; // Assume inactive if API call fails
    }

    const stream = await response.json();
    const status = stream.data?.status;
    
    // Stream is inactive if status is 'idle' or 'disabled'
    return status === "idle" || status === "disabled";
  } catch (error) {
    console.error("Failed to verify stream status:", error);
    return true; // Assume inactive on error
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify authorization
    const isAuthorized = await verifyAuthorization(req);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limiting
    const identifier = req.headers.get("x-internal-secret") || "admin";
    if (await isRateLimited(identifier)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    console.log("🔄 Starting inactive session cleanup...");

    // Find sessions that are open but haven't been updated in 15+ minutes
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - INACTIVITY_THRESHOLD_MINUTES);

    const inactiveSessions = await sql`
      SELECT 
        ss.id,
        ss.user_id,
        ss.mux_session_id,
        ss.started_at,
        u.username,
        u.mux_stream_id,
        u.is_live
      FROM stream_sessions ss
      INNER JOIN users u ON ss.user_id = u.id
      WHERE ss.ended_at IS NULL
        AND ss.started_at < ${cutoffTime.toISOString()}
      ORDER BY ss.started_at ASC
    `;

    if (inactiveSessions.rows.length === 0) {
      console.log("✅ No inactive sessions found");
      return NextResponse.json({
        message: "No inactive sessions to close",
        sessions_checked: 0,
        sessions_closed: 0,
      });
    }

    console.log(`📊 Found ${inactiveSessions.rows.length} potentially inactive session(s)`);

    const results = {
      sessions_checked: inactiveSessions.rows.length,
      sessions_closed: 0,
      sessions_still_active: 0,
      sessions_with_errors: 0,
      details: [] as any[],
    };

    // Process each inactive session
    for (const session of inactiveSessions.rows) {
      try {
        // Verify stream is actually inactive via Mux API
        let shouldClose = true;
        
        if (session.mux_stream_id) {
          shouldClose = await verifyStreamInactive(session.mux_stream_id);
        }

        if (!shouldClose) {
          console.log(`⏭️ Stream still active: ${session.username} - skipping`);
          results.sessions_still_active++;
          results.details.push({
            session_id: session.id,
            username: session.username,
            action: "skipped",
            reason: "Stream still active on Mux",
          });
          continue;
        }

        // Close the stream session
        await sql`
          UPDATE stream_sessions SET
            ended_at = NOW()
          WHERE id = ${session.id}
        `;

        // Update user status if they're marked as live
        if (session.is_live) {
          await sql`
            UPDATE users SET
              is_live = false,
              stream_started_at = NULL,
              current_viewers = 0
            WHERE id = ${session.user_id}
          `;
        }

        const duration = Math.floor(
          (Date.now() - new Date(session.started_at).getTime()) / 1000 / 60
        );

        console.log(
          `✅ Closed inactive session: ${session.username} (${duration} minutes inactive)`
        );

        results.sessions_closed++;
        results.details.push({
          session_id: session.id,
          username: session.username,
          action: "closed",
          inactive_duration_minutes: duration,
        });
      } catch (sessionError) {
        console.error(
          `❌ Failed to close session ${session.id}:`,
          sessionError
        );
        results.sessions_with_errors++;
        results.details.push({
          session_id: session.id,
          username: session.username,
          action: "error",
          error:
            sessionError instanceof Error
              ? sessionError.message
              : "Unknown error",
        });
      }
    }

    console.log(
      `✅ Inactive session cleanup complete: ${results.sessions_closed} closed, ${results.sessions_still_active} still active, ${results.sessions_with_errors} errors`
    );

    return NextResponse.json({
      message: "Inactive session cleanup completed",
      ...results,
    });
  } catch (error) {
    console.error("❌ Cron job error:", error);
    return NextResponse.json(
      {
        error: "Failed to close inactive sessions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(req: NextRequest) {
  try {
    const isAuthorized = await verifyAuthorization(req);
    
    // Count currently open sessions
    const openSessions = await sql`
      SELECT COUNT(*) as count
      FROM stream_sessions
      WHERE ended_at IS NULL
    `;

    // Count inactive sessions (15+ minutes without activity)
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - INACTIVITY_THRESHOLD_MINUTES);

    const inactiveSessions = await sql`
      SELECT COUNT(*) as count
      FROM stream_sessions
      WHERE ended_at IS NULL
        AND started_at < ${cutoffTime.toISOString()}
    `;

    return NextResponse.json({
      status: "ok",
      message: "Cron job endpoint is active",
      authorized: isAuthorized,
      inactivity_threshold_minutes: INACTIVITY_THRESHOLD_MINUTES,
      statistics: {
        open_sessions: parseInt(openSessions.rows[0].count),
        inactive_sessions: parseInt(inactiveSessions.rows[0].count),
      },
    });
  } catch (error) {
    console.error("❌ Health check error:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
