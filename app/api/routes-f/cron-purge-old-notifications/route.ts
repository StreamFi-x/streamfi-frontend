/**
 * POST /api/routes-f/cron-purge-old-notifications (#1558)
 *
 * Vercel Cron endpoint. Deletes notifications older than 90 days that have
 * already been read — unread notifications are kept regardless of age so a
 * viewer never silently loses something they haven't seen yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore, setStore } from "./store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AGE_DAYS = 90;

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
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const store = getStore();

    const kept = [];
    const removedIds: string[] = [];

    for (const notification of store) {
      const isOld = new Date(notification.created_at).getTime() < cutoff;
      if (isOld && notification.read) {
        removedIds.push(notification.id);
      } else {
        kept.push(notification);
      }
    }

    setStore(kept);

    return NextResponse.json({
      purged_at: new Date().toISOString(),
      max_age_days: MAX_AGE_DAYS,
      removed_count: removedIds.length,
      removed_ids: removedIds,
    });
  } catch (error) {
    console.error("[cron-purge-old-notifications] failed:", error);
    return NextResponse.json(
      { error: "Failed to purge old notifications" },
      { status: 500 }
    );
  }
}
