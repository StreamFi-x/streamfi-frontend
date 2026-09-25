/**
 * POST /api/routes-f/cron-dispatch-scheduled-reminders (#1557)
 *
 * Vercel Cron endpoint. Dispatches stream reminder pushes for every
 * scheduled reminder whose fires_at falls within the next hour bucket
 * (now, now + 1h], and marks each as dispatched so a later run doesn't
 * send it again. Reminders already past due (fires_at <= now) or already
 * dispatched are left untouched.
 *
 * Actual push delivery is out of scope for this mock route — dispatching
 * here means marking the reminder as sent and reporting it in the
 * response, which is what a real implementation would do after a
 * successful send.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "./store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {return false;}

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const bucketEnd = now + BUCKET_WINDOW_MS;
    const store = getStore();

    const dispatched: { id: string; stream_id: string; viewer_id: string }[] = [];
    const dispatchedAt = new Date(now).toISOString();

    for (const reminder of store) {
      if (reminder.dispatched) {continue;}

      const firesAtMs = new Date(reminder.fires_at).getTime();
      const inNextHourBucket = firesAtMs > now && firesAtMs <= bucketEnd;
      if (!inNextHourBucket) {continue;}

      reminder.dispatched = true;
      reminder.dispatched_at = dispatchedAt;
      dispatched.push({
        id: reminder.id,
        stream_id: reminder.stream_id,
        viewer_id: reminder.viewer_id,
      });
    }

    return NextResponse.json({
      dispatched_at: dispatchedAt,
      bucket_window_minutes: BUCKET_WINDOW_MS / 60_000,
      dispatched_count: dispatched.length,
      dispatched,
    });
  } catch (error) {
    console.error("[cron-dispatch-scheduled-reminders] failed:", error);
    return NextResponse.json(
      { error: "Failed to dispatch scheduled reminders" },
      { status: 500 }
    );
  }
}
