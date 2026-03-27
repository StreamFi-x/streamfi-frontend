/**
 * POST /api/routes-f/jobs/process
 *
 * Called by Vercel Cron every minute.
 * Secured by the CRON_SECRET environment variable (set in Vercel project settings).
 *
 * vercel.json entry:
 *   { "path": "/api/routes-f/jobs/process", "schedule": "* * * * *" }
 */

import { NextRequest, NextResponse } from "next/server";
import { processNextJob, cleanupOldJobs } from "../_lib/process";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret — Vercel sets the Authorization header automatically
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobId = await processNextJob();
    const cleaned = await cleanupOldJobs();

    return NextResponse.json({
      processed: jobId ?? null,
      cleaned,
    });
  } catch (err) {
    console.error("[jobs/process] Cron error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
