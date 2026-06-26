import { NextRequest, NextResponse } from "next/server";
import type { ScheduledStream, UpcomingStreamsResponse } from "./types";
import { getScheduledStreams } from "./seed";

const DEFAULT_WITHIN_HOURS = 48;
const MAX_WITHIN_HOURS = 24 * 14; // two weeks

/**
 * GET /api/routes-f/upcoming-streams?within_hours=48&category=gaming
 *
 * Lists streams creators have scheduled but not yet started, within the given
 * forward-looking time window, optionally filtered by category, sorted by
 * starts_at ascending (soonest first).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;

  let withinHours = DEFAULT_WITHIN_HOURS;
  const withinRaw = params.get("within_hours");
  if (withinRaw !== null) {
    const parsed = Number(withinRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json(
        { error: "within_hours must be a positive number" },
        { status: 400 }
      );
    }
    if (parsed > MAX_WITHIN_HOURS) {
      return NextResponse.json(
        { error: `within_hours must be at most ${MAX_WITHIN_HOURS}` },
        { status: 400 }
      );
    }
    withinHours = parsed;
  }

  const category = params.get("category")?.trim().toLowerCase() || null;

  const now = Date.now();
  const windowEnd = now + withinHours * 60 * 60 * 1000;

  const scheduled: ScheduledStream[] = getScheduledStreams(now)
    .filter(stream => {
      const startsAt = new Date(stream.starts_at).getTime();
      // Must be in the future (not yet started) and within the window.
      if (startsAt <= now || startsAt > windowEnd) return false;
      if (category && stream.category.toLowerCase() !== category) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

  return NextResponse.json({ scheduled } as UpcomingStreamsResponse);
}
