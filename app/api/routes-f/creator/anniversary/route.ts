import { NextRequest, NextResponse } from "next/server";
import type { CreatorStats, Milestone, MilestoneKind, AnniversaryResponse } from "./types";
import { getCreatorStats } from "./seed";

const LOOK_AHEAD_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// Stream count milestones
const STREAM_MILESTONES = [100, 500, 1000];
// Follower milestones
const FOLLOWER_MILESTONES = [100, 1000, 10000];
// Year anniversaries to check
const YEAR_ANNIVERSARIES = [1, 2, 3];

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().split("T")[0];
}

function computeMilestones(stats: CreatorStats, onDate: number): Milestone[] {
  const milestones: Milestone[] = [];
  const windowEnd = onDate + LOOK_AHEAD_DAYS * DAY_MS;

  // Year anniversaries: look at the anniversary date for each year
  for (const years of YEAR_ANNIVERSARIES) {
    const anniversaryDate = stats.joined_at + years * 365 * DAY_MS;
    if (anniversaryDate >= onDate && anniversaryDate <= windowEnd) {
      milestones.push({
        kind: `${years}_year_anniversary` as MilestoneKind,
        label: `${years} Year Anniversary`,
        date: isoDate(anniversaryDate),
        creator_id: stats.creator_id,
        creator_name: stats.display_name,
      });
    }
  }

  // Stream count milestones: if they're within a plausible range (already hit or hit today)
  for (const target of STREAM_MILESTONES) {
    if (stats.stream_count >= target) {
      // Estimate when they hit this — assume ~1 stream/day rate
      const streamsAgo = stats.stream_count - target;
      const estimatedDate = onDate - streamsAgo * DAY_MS;
      if (estimatedDate >= onDate && estimatedDate <= windowEnd) {
        milestones.push({
          kind: `${target}th_stream` as MilestoneKind,
          label: `${target}th Stream`,
          date: isoDate(estimatedDate),
          creator_id: stats.creator_id,
          creator_name: stats.display_name,
        });
      }
    }
  }

  // Follower milestones: same logic
  for (const target of FOLLOWER_MILESTONES) {
    if (stats.follower_count >= target) {
      const followersAgo = stats.follower_count - target;
      // Rough estimate: 10 followers/day growth rate
      const estimatedDate = onDate - (followersAgo / 10) * DAY_MS;
      if (estimatedDate >= onDate && estimatedDate <= windowEnd) {
        milestones.push({
          kind: `${target}th_follower` as MilestoneKind,
          label: `${target}th Follower`,
          date: isoDate(estimatedDate),
          creator_id: stats.creator_id,
          creator_name: stats.display_name,
        });
      }
    }
  }

  return milestones;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  const onDateParam = searchParams.get("on_date");

  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const stats = getCreatorStats(creatorId);
  if (!stats) {
    return NextResponse.json(
      { error: `creator '${creatorId}' not found` },
      { status: 404 }
    );
  }

  // Resolve the reference date
  let onDate: number;
  if (onDateParam) {
    const parsed = Date.parse(onDateParam);
    if (isNaN(parsed)) {
      return NextResponse.json(
        { error: "on_date must be a valid ISO date string (e.g. 2025-06-01)" },
        { status: 400 }
      );
    }
    onDate = parsed;
  } else {
    onDate = new Date().setHours(0, 0, 0, 0);
  }

  const allMilestones = computeMilestones(stats, onDate);
  const todayStr = isoDate(onDate);

  const today = allMilestones.filter(m => m.date === todayStr);
  const upcoming = allMilestones.filter(m => m.date !== todayStr);

  return NextResponse.json({
    today,
    upcoming,
    on_date: todayStr,
  } as AnniversaryResponse);
}
