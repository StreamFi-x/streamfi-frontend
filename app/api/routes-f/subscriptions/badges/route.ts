import { NextRequest, NextResponse } from "next/server";
import { subscriptions } from "../route";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  const subscriberId = searchParams.get("subscriber_id");

  if (!creatorId || !subscriberId) {
    return NextResponse.json(
      { error: "creator_id and subscriber_id are required" },
      { status: 400 }
    );
  }

  const now = Date.now();

  // Find all subscriptions matching user and creator
  const userSubs = Array.from(subscriptions.values()).filter(
    (sub) => sub.subscriber_id === subscriberId && sub.creator_id === creatorId
  );

  // Check if there is a currently active subscription (active until expires_at)
  const activeSub = userSubs.find(
    (sub) =>
      new Date(sub.expires_at).getTime() > now &&
      new Date(sub.started_at).getTime() <= now
  );

  const has_sub = !!activeSub;

  // Stack months_subscribed across non-overlapping subs
  const intervals = userSubs.map((sub) => ({
    start: new Date(sub.started_at).getTime(),
    end: new Date(sub.expires_at).getTime(),
  }));

  // Sort intervals by start time
  intervals.sort((a, b) => a.start - b.start);

  // Merge overlapping intervals
  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push(interval);
    } else {
      const last = merged[merged.length - 1];
      if (interval.start <= last.end) {
        // Overlapping or adjacent, merge
        last.end = Math.max(last.end, interval.end);
      } else {
        // Non-overlapping
        merged.push(interval);
      }
    }
  }

  const totalDurationMs = merged.reduce(
    (sum, interval) => sum + (interval.end - interval.start),
    0
  );
  const totalDays = totalDurationMs / (24 * 60 * 60 * 1000);
  const months_subscribed = Math.floor(totalDays / 30);

  if (has_sub) {
    return NextResponse.json({
      has_sub,
      tier_id: activeSub.tier_id,
      badge_url: "/api/routes-f/subscriptions/badges/svg",
      months_subscribed,
    });
  }

  return NextResponse.json({
    has_sub,
    months_subscribed,
  });
}
