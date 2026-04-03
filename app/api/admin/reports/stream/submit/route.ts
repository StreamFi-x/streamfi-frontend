import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

// 5 stream reports per IP per minute
const isRateLimited = createRateLimiter(60_000, 5);

export async function POST(req: NextRequest): Promise<Response> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await req.json();
  const { stream_id, streamer, reason, details, reporter_id } = body;

  if (!stream_id || !streamer || !reason) {
    return Response.json(
      { error: "stream_id, streamer, and reason are required" },
      { status: 400 }
    );
  }

  try {
    await sql`
      INSERT INTO stream_reports (reporter_id, stream_id, streamer, reason, details)
      VALUES (
        ${reporter_id ?? "anonymous"},
        ${stream_id},
        ${streamer},
        ${reason},
        ${details ?? null}
      )
    `;
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[reports/stream/submit] DB error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
