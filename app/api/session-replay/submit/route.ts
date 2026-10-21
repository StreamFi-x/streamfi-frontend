import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";
import type { SessionReplayReport } from "@/lib/session-replay/types";

export const runtime = "nodejs";

/**
 * POST /api/session-replay/submit (#1750)
 *
 * Receives a breadcrumb reconstruction captured by lib/session-replay when a
 * wallet or tipping flow fails on the client. Reports are reviewable by
 * admins at /admin/replays.
 */

// 20 replay reports per IP per minute
const isRateLimited = createRateLimiter(60_000, 20);

const VALID_FLOWS = new Set(["wallet", "tipping", "general"]);
const MAX_BREADCRUMBS = 50;
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let report: SessionReplayReport;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Report too large" }, { status: 413 });
    }
    report = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof report?.id !== "string" ||
    typeof report.errorMessage !== "string" ||
    !VALID_FLOWS.has(report.flow) ||
    !Array.isArray(report.breadcrumbs)
  ) {
    return NextResponse.json({ error: "Invalid report data" }, { status: 400 });
  }

  const timestamp = Number.isFinite(report.timestamp)
    ? new Date(report.timestamp)
    : new Date();

  try {
    await sql`
      INSERT INTO session_replays (
        id, flow, error_message, error_stack, error_details,
        breadcrumbs, environment, created_at
      ) VALUES (
        ${report.id.slice(0, 64)},
        ${report.flow},
        ${report.errorMessage.slice(0, 2000)},
        ${report.errorStack ? String(report.errorStack).slice(0, 8000) : null},
        ${JSON.stringify(report.errorDetails ?? null)}::JSONB,
        ${JSON.stringify(report.breadcrumbs.slice(-MAX_BREADCRUMBS))}::JSONB,
        ${JSON.stringify(report.environment ?? {})}::JSONB,
        ${timestamp}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    return NextResponse.json({ ok: true, id: report.id }, { status: 201 });
  } catch (error) {
    console.error("[session-replay/submit] DB error:", error);
    return NextResponse.json(
      { error: "Failed to store replay" },
      { status: 500 }
    );
  }
}
