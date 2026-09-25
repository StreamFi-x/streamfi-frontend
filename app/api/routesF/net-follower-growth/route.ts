/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type DailySeries = {
  date: string;
  net_change: number;
};

type FollowerGrowth = {
  gained: number;
  lost: number;
  net: number;
  daily_series: DailySeries[];
};

const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  window_days: z.string().optional().default("30").transform(val => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 30 : Math.min(num, 365);
  })
});

function getSeededFollowEvents(creatorId: string, windowDays: number): Array<{ type: "follow" | "unfollow"; date: string }> {
  const hash = creatorId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const seed = hash % 10000;

  const events: Array<{ type: "follow" | "unfollow"; date: string }> = [];
  const today = new Date("2024-01-01");

  for (let i = 0; i < windowDays; i++) {
    const eventDate = new Date(today);
    eventDate.setDate(eventDate.getDate() + i);
    const dateStr = eventDate.toISOString().split("T")[0];

    const pseudo = (seed * 7919 + i * 1103) % 100;
    const followCount = 3 + ((seed * 113 + i * 97) % 12);
    const unfollowCount = 1 + ((seed * 227 + i * 211) % 8);

    for (let f = 0; f < followCount; f++) {
      events.push({ type: "follow", date: dateStr });
    }
    for (let u = 0; u < unfollowCount; u++) {
      events.push({ type: "unfollow", date: dateStr });
    }
  }

  return events;
}

function computeFollowerGrowth(events: Array<{ type: "follow" | "unfollow"; date: string }>): FollowerGrowth {
  let gained = 0;
  let lost = 0;

  const dailyMap: Record<string, number> = {};

  for (const event of events) {
    if (event.type === "follow") {
      gained += 1;
      dailyMap[event.date] = (dailyMap[event.date] ?? 0) + 1;
    } else {
      lost += 1;
      dailyMap[event.date] = (dailyMap[event.date] ?? 0) - 1;
    }
  }

  const daily_series: DailySeries[] = [];
  for (const [date, netChange] of Object.entries(dailyMap)) {
    daily_series.push({ date, net_change: netChange });
  }

  daily_series.sort((a, b) => a.date.localeCompare(b.date));

  return {
    gained,
    lost,
    net: gained - lost,
    daily_series
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    creator_id: searchParams.get("creator_id"),
    window_days: searchParams.get("window_days")
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { creator_id, window_days } = validation.data;
  const events = getSeededFollowEvents(creator_id, window_days);
  const growth = computeFollowerGrowth(events);

  return NextResponse.json(growth);
}
