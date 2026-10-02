/**
 * /api/routes-f/clip-report
 *
 * POST: a viewer reports a clip for review.
 * GET ?clip_id: the count of currently active (non-dismissed) reports.
 *
 * Rate limited to 5 reports per viewer per 15-minute rolling window so one
 * viewer can't spam reports against a clip.
 */
import { NextRequest, NextResponse } from "next/server";
import type { ClipReportRequestBody, ClipReportResponse } from "./types";
import { CLIP_REPORT_REASONS } from "./types";
import {
  submitClipReport,
  countActiveReports,
  RateLimitExceededError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ClipReportRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { clip_id, reporter_id, reason, description } = body;

  if (!clip_id || typeof clip_id !== "string") {
    return NextResponse.json(
      { error: "clip_id is required" },
      { status: 400 }
    );
  }
  if (!reporter_id || typeof reporter_id !== "string") {
    return NextResponse.json(
      { error: "reporter_id is required" },
      { status: 400 }
    );
  }
  if (!reason || !CLIP_REPORT_REASONS.includes(reason)) {
    return NextResponse.json(
      {
        error: `reason must be one of: ${CLIP_REPORT_REASONS.join(", ")}`,
      },
      { status: 400 }
    );
  }
  if (description !== undefined && typeof description !== "string") {
    return NextResponse.json(
      { error: "description must be a string" },
      { status: 400 }
    );
  }

  try {
    const report = submitClipReport({
      clip_id,
      reporter_id,
      reason,
      description,
    });

    return NextResponse.json({
      report_id: report.report_id,
    } as ClipReportResponse);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many reports. Try again later." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }
    throw error;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json(
      { error: "clip_id is required" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    clip_id: clipId,
    active_reports: countActiveReports(clipId),
  });
}
