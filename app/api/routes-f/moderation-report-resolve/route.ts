/**
 * PATCH /api/routes-f/moderation-report-resolve
 *
 * A moderator resolves an open moderation report with a decision.
 *
 * Body: { reportId: string, outcome: "dismissed" | "warned" | "timeout" | "banned" }
 *
 * Response 200:
 *   { reportId, status: "resolved", outcome, resolved_at }
 *
 * Error responses:
 *   400 — missing/invalid reportId or outcome
 *   404 — reportId does not exist
 *   409 — report has already been resolved
 */
import { NextRequest, NextResponse } from "next/server";
import type { ReportOutcome, ResolveReportResponse } from "./types";
import {
  resolveReport,
  ReportAlreadyResolvedError,
  ReportNotFoundError,
} from "./store";

const VALID_OUTCOMES: ReportOutcome[] = [
  "dismissed",
  "warned",
  "timeout",
  "banned",
];

function isValidOutcome(value: unknown): value is ReportOutcome {
  return (
    typeof value === "string" &&
    VALID_OUTCOMES.includes(value as ReportOutcome)
  );
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: { reportId?: unknown; outcome?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reportId, outcome } = body;

  if (!reportId || typeof reportId !== "string") {
    return NextResponse.json(
      { error: "reportId is required and must be a string" },
      { status: 400 }
    );
  }

  if (!isValidOutcome(outcome)) {
    return NextResponse.json(
      {
        error: `outcome is required and must be one of: ${VALID_OUTCOMES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const report = resolveReport(reportId, outcome);
    const response: ResolveReportResponse = {
      reportId: report.reportId,
      status: "resolved",
      outcome: report.outcome as ReportOutcome,
      resolved_at: report.resolved_at as string,
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ReportNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ReportAlreadyResolvedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
