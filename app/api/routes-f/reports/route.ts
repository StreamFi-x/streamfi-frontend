import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

const REPORT_REASONS = [
  "spam",
  "harassment",
  "inappropriate_content",
  "copyright",
  "other",
] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

const isIpRateLimited = createRateLimiter(10 * 60 * 1000, 5); // 5 reports per 10 minutes per IP

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function hashReporterIp(ip: string): string {
  const salt =
    process.env.REPORT_IP_HASH_SALT ??
    process.env.SESSION_SECRET ??
    "streamfi-report-ip-salt";

  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

async function ensureReportsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id TEXT NOT NULL,
      streamer TEXT NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate_content', 'copyright', 'other')),
      details TEXT,
      reporter_ip_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function isValidReason(reason: unknown): reason is ReportReason {
  return (
    typeof reason === "string" &&
    (REPORT_REASONS as readonly string[]).includes(reason)
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (await isIpRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many reports. Please try again later." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  let body: {
    stream_id?: unknown;
    streamer?: unknown;
    reason?: unknown;
    details?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const streamId =
    typeof body.stream_id === "string" ? body.stream_id.trim() : "";
  const streamer = typeof body.streamer === "string" ? body.streamer.trim() : "";
  const reason = body.reason;
  const details =
    typeof body.details === "string" ? body.details.trim() : undefined;

  if (!streamId) {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  if (!streamer) {
    return NextResponse.json({ error: "streamer is required" }, { status: 400 });
  }

  if (!isValidReason(reason)) {
    return NextResponse.json(
      {
        error:
          "reason must be one of: spam, harassment, inappropriate_content, copyright, other",
      },
      { status: 400 }
    );
  }

  if (details !== undefined && details.length > 2000) {
    return NextResponse.json(
      { error: "details must be 2000 characters or fewer" },
      { status: 400 }
    );
  }

  try {
    await ensureReportsTable();

    const reporterIpHash = hashReporterIp(ip);

    const { rows } = await sql`
      INSERT INTO stream_reports (
        stream_id,
        streamer,
        reason,
        details,
        reporter_ip_hash
      )
      VALUES (
        ${streamId},
        ${streamer},
        ${reason},
        ${details ?? null},
        ${reporterIpHash}
      )
      RETURNING id
    `;

    return NextResponse.json(
      {
        message: "Report submitted successfully",
        confirmationId: rows[0].id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[reports] submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 }
    );
  }
}
