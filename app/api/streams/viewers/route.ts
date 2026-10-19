import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { ipToCountry } from "@/lib/geolocation/ip-to-country";
import {
  createViewerSession,
  verifyViewerSessionToken,
} from "@/lib/stream/viewer-session-token";

// The GET handler mints a fresh session per request — it must never be cached
// or every viewer would receive the same sessionId and collapse into one.
export const dynamic = "force-dynamic";

// Two limits cooperate here (#725): a coarse per-IP cap bounds abuse from a
// single origin across any stream, and a per-IP+stream cap bounds how fast one
// origin can inflate any single stream's counters. Neither is keyed by the
// client-chosen sessionId (which was the whole problem) — the per-stream key
// comes from the server-issued viewer token's `pid`.
const IP_WINDOW_MS = 60_000;
const IP_MAX_REQUESTS = 120;
const STREAM_MAX_REQUESTS = 60;

const isIpRateLimited = createRateLimiter(IP_WINDOW_MS, IP_MAX_REQUESTS);
const isStreamRateLimited = createRateLimiter(
  IP_WINDOW_MS,
  STREAM_MAX_REQUESTS
);

const RATE_LIMITED_RESPONSE = {
  error: "Too many requests",
} as const;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function isRateLimited(
  ip: string,
  stream?: string | null
): Promise<boolean> {
  if (await isIpRateLimited(ip)) {
    return true;
  }
  if (stream && (await isStreamRateLimited(`${ip}|${stream}`))) {
    return true;
  }
  return false;
}

/**
 * Viewer token is accepted either in the JSON body (`token`) or the
 * `x-viewer-token` header. Body is the primary channel; the header keeps the
 * heartbeat path (which is a tiny JSON payload) convenient.
 */
function extractViewerToken(req: Request, body: unknown): unknown {
  const header = req.headers.get("x-viewer-token");
  if (header) {
    return header;
  }
  if (body && typeof body === "object" && "token" in body) {
    return (body as { token?: unknown }).token;
  }
  return undefined;
}

/**
 * GET /api/streams/viewers?playbackId=... (#725)
 *
 * Mints a viewer session for the stream. The returned `sessionId` is generated
 * server-side and signed into `token`; the client must present both on every
 * subsequent POST/PATCH/DELETE. Anonymous callers are allowed — this is not an
 * auth gate, it makes the session id unforgeable and tieable to one stream.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  if (await isRateLimited(ip)) {
    return NextResponse.json(RATE_LIMITED_RESPONSE, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const playbackId = new URL(req.url).searchParams.get("playbackId");
  if (!playbackId) {
    return NextResponse.json(
      { error: "Playback ID is required" },
      { status: 400 }
    );
  }

  try {
    const result = await sql`
      SELECT id
      FROM users
      WHERE mux_playback_id = ${playbackId}
        AND is_live = true
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Stream is not currently live" },
        { status: 404 }
      );
    }

    const session = createViewerSession(playbackId);
    return NextResponse.json(session, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Viewer session mint error:", error);
    return NextResponse.json(
      { error: "Failed to start viewer session" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (await isRateLimited(ip)) {
    return NextResponse.json(RATE_LIMITED_RESPONSE, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  try {
    const body = await req.json();
    const { playbackId, sessionId, userId } = body ?? {};

    if (!playbackId || !sessionId) {
      return NextResponse.json(
        { error: "Playback ID and session ID are required" },
        { status: 400 }
      );
    }

    // #725: the session id must be the one carried in a server-issued token
    // bound to this exact stream. A client can no longer invent a session id.
    const claims = verifyViewerSessionToken(extractViewerToken(req, body), {
      playbackId,
      sessionId,
    });
    if (!claims) {
      return NextResponse.json(
        { error: "A valid viewer session token is required" },
        { status: 401 }
      );
    }

    // Rate-limit by the *token-bound* stream, not the freely supplied one.
    if (await isRateLimited(ip, claims.pid)) {
      return NextResponse.json(RATE_LIMITED_RESPONSE, {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }

    // Single query: fetch stream + active session together
    const result = await sql`
      SELECT
        u.id,
        u.username,
        u.is_live,
        ss.id AS session_id
      FROM users u
      LEFT JOIN stream_sessions ss
        ON u.id = ss.user_id AND ss.ended_at IS NULL
      WHERE u.mux_playback_id = ${playbackId} AND u.deleted_at IS NULL
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const stream = result.rows[0];

    if (!stream.is_live) {
      return NextResponse.json(
        { error: "Stream is not currently live" },
        { status: 409 }
      );
    }

    // --- Deduplicate: check if this viewer session is already counted ---
    // Wrapped in try/catch so a missing stream_viewers table never blocks the count.
    const alreadyCounted = false;
    try {
      const existingViewer = await sql`
        SELECT id FROM stream_viewers
        WHERE session_id = ${sessionId} AND left_at IS NULL
      `;
      if (existingViewer.rows.length > 0) {
        return NextResponse.json(
          { message: "Already tracking this viewer" },
          { status: 200 }
        );
      }
    } catch {
      // stream_viewers table may not exist yet — skip dedup, still count viewer
    }

    // --- Core: always increment current_viewers on the users row ---
    const updated = await sql`
      UPDATE users SET
        current_viewers = current_viewers + 1,
        total_views     = total_views + 1,
        updated_at      = CURRENT_TIMESTAMP
      WHERE id = ${stream.id}
      RETURNING current_viewers
    `;
    const newViewerCount = updated.rows[0].current_viewers;

    // --- Best-effort session analytics (stream_viewers + stream_sessions) ---
    // These fail silently if the tables don't exist or session record is missing.
    if (stream.session_id && !alreadyCounted) {
      try {
        // Resolve country from headers or IP geolocation (#1383, #777)
        const headerCountry =
          req.headers.get("cf-ipcountry") ||
          req.headers.get("x-vercel-ip-country") ||
          null;
        const normalizedHeaderCountry =
          headerCountry && headerCountry !== "XX" && headerCountry.length === 2
            ? headerCountry.toUpperCase()
            : null;

        let countryCode = normalizedHeaderCountry;
        if (!countryCode) {
          const geoResult = await ipToCountry(ip);
          countryCode = geoResult?.country || null;
        }

        await sql`
          INSERT INTO stream_viewers (stream_session_id, user_id, session_id, joined_at, ip_address, country)
          VALUES (${stream.session_id}, ${userId ?? null}, ${sessionId}, CURRENT_TIMESTAMP, ${ip}::INET, ${countryCode})
        `;
        await sql`
          UPDATE stream_sessions SET
            peak_viewers         = GREATEST(peak_viewers, ${newViewerCount}),
            total_unique_viewers = total_unique_viewers + 1
          WHERE id = ${stream.session_id}
        `;
      } catch {
        // Analytics tables missing or schema mismatch — viewer count is already updated above
      }
    }

    return NextResponse.json(
      {
        message: "Viewer joined successfully",
        currentViewers: newViewerCount,
        streamInfo: { username: stream.username, isLive: stream.is_live },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Viewer join error:", error);
    return NextResponse.json(
      { error: "Failed to join stream" },
      { status: 500 }
    );
  }
}

/**
 * Heartbeat (#1403): touched periodically by the watch page while a viewer
 * is still actually on the page, so the reconciliation job can tell a
 * still-watching viewer apart from one whose leave call never fired (tab
 * closed, connection lost, browser crashed). No-ops (200, not an error) if
 * the row was already closed by that job or an explicit leave, since the
 * heartbeat losing a benign race against either is expected, not a failure
 * the client needs to react to.
 *
 * #725: requires the viewer token, and only touches rows whose session id is
 * the one bound to that token.
 */
export async function PATCH(req: NextRequest) {
  const ip = clientIp(req);

  if (await isRateLimited(ip)) {
    return NextResponse.json(RATE_LIMITED_RESPONSE, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  try {
    const body = await req.json();
    const { sessionId } = body ?? {};

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const claims = verifyViewerSessionToken(extractViewerToken(req, body), {
      sessionId,
    });
    if (!claims) {
      return NextResponse.json(
        { error: "A valid viewer session token is required" },
        { status: 401 }
      );
    }

    if (await isRateLimited(ip, claims.pid)) {
      return NextResponse.json(RATE_LIMITED_RESPONSE, {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }

    try {
      await sql`
        UPDATE stream_viewers SET heartbeat_at = CURRENT_TIMESTAMP
        WHERE session_id = ${sessionId} AND left_at IS NULL
      `;
    } catch {
      // stream_viewers table or heartbeat_at column may not exist yet in
      // this environment — never fail the client over a missing analytics
      // table, matching this route's own POST/DELETE fallback behavior.
    }

    return NextResponse.json(
      { message: "Heartbeat recorded" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Viewer heartbeat error:", error);
    return NextResponse.json(
      { error: "Failed to record heartbeat" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const ip = clientIp(req);

  if (await isRateLimited(ip)) {
    return NextResponse.json(RATE_LIMITED_RESPONSE, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  try {
    const body = await req.json();
    const { sessionId, playbackId } = body ?? {};

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // #725: a client can only leave a session it was actually issued. This
    // closes the saboteur path of DELETEing a guessed/brute-forced session id
    // to zero out someone else's viewer count.
    const claims = verifyViewerSessionToken(extractViewerToken(req, body), {
      sessionId,
      ...(playbackId ? { playbackId } : {}),
    });
    if (!claims) {
      return NextResponse.json(
        { error: "A valid viewer session token is required" },
        { status: 401 }
      );
    }

    if (await isRateLimited(ip, claims.pid)) {
      return NextResponse.json(RATE_LIMITED_RESPONSE, {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }

    // --- Primary path: stream_viewers record exists ---
    try {
      const viewerResult = await sql`
        UPDATE stream_viewers SET left_at = CURRENT_TIMESTAMP
        WHERE session_id = ${sessionId} AND left_at IS NULL
        RETURNING stream_session_id
      `;

      if (viewerResult.rows.length > 0) {
        const streamSessionId = viewerResult.rows[0].stream_session_id;
        const sessionResult = await sql`
          SELECT user_id FROM stream_sessions WHERE id = ${streamSessionId}
        `;
        if (sessionResult.rows.length > 0) {
          await sql`
            UPDATE users SET
              current_viewers = GREATEST(current_viewers - 1, 0),
              updated_at      = CURRENT_TIMESTAMP
            WHERE id = ${sessionResult.rows[0].user_id}
          `;
        }
        return NextResponse.json(
          { message: "Viewer left successfully" },
          { status: 200 }
        );
      }
    } catch {
      // stream_viewers or stream_sessions table missing — fall through to playbackId path
    }

    // --- Fallback path: use the token-bound playbackId to decrement directly ---
    // (Never the request body's playbackId — that is client-chosen.)
    await sql`
      UPDATE users SET
        current_viewers = GREATEST(current_viewers - 1, 0),
        updated_at      = CURRENT_TIMESTAMP
      WHERE mux_playback_id = ${claims.pid} AND current_viewers > 0
    `;

    return NextResponse.json(
      { message: "Viewer left successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Viewer leave error:", error);
    return NextResponse.json(
      { error: "Failed to leave stream" },
      { status: 500 }
    );
  }
}
