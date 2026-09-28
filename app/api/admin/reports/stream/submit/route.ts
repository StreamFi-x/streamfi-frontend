import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifySession } from "@/lib/auth/verify-session";
import { assessReportAbuse } from "@/lib/stream/report-abuse-detection";

// 5 stream reports per IP per minute — the baseline anyone (including an
// anonymous, unauthenticated reporter) is subject to. Does not stop a
// brigade on its own (many distinct IPs), which is what the per-account
// limit below and the coordination heuristics in assessReportAbuse exist
// for.
const isIpRateLimited = createRateLimiter(60_000, 5);

// A logged-in reporter is additionally limited per account: tighter than
// the IP limit (an account is a stronger identity signal than an IP,
// which can be shared or rotated), but still generous enough that a real
// viewer flagging several different streams in a day is never blocked.
const isAccountRateLimited = createRateLimiter(60 * 60 * 1000, 10);

export async function POST(req: NextRequest): Promise<Response> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isIpRateLimited(ip)) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Anonymous reporting stays allowed (lower friction for flagging
  // egregious content from a logged-out viewer), but identity for any
  // authenticated reporter comes from the verified session, never a
  // client-supplied field — otherwise every per-account and coordination
  // signal below could be trivially evaded by sending a different fake id
  // per request.
  const session = await verifySession(req);
  const reporterUserId = session.ok ? session.userId : null;
  const isAnonymous = !session.ok;

  if (reporterUserId && (await isAccountRateLimited(reporterUserId))) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const body = await req.json();
  const { stream_id, streamer, reason, details } = body;

  if (!stream_id || !streamer || !reason) {
    return Response.json(
      { error: "stream_id, streamer, and reason are required" },
      { status: 400 }
    );
  }

  try {
    const { priority, flags } = await assessReportAbuse({
      streamId: stream_id,
      reason,
      reporterUserId,
    });

    const { rows } = await sql`
      INSERT INTO stream_reports
        (reporter_id, reporter_user_id, is_anonymous, priority, stream_id, streamer, reason, details)
      VALUES (
        ${reporterUserId ?? "anonymous"},
        ${reporterUserId},
        ${isAnonymous},
        ${priority},
        ${stream_id},
        ${streamer},
        ${reason},
        ${details ?? null}
      )
      RETURNING id
    `;
    const reportId = rows[0].id;

    if (flags.length > 0) {
      for (const flag of flags) {
        await sql`
          INSERT INTO stream_report_flags (report_id, signal, detail)
          VALUES (${reportId}, ${flag.signal}, ${JSON.stringify(flag.detail)})
        `;
      }
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[reports/stream/submit] DB error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
