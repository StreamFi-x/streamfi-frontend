import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type NotificationOpenRate = {
  notifications_sent: number;
  opened: number;
  open_rate_percent: number;
};

const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  window_days: z.string().optional().default("30").transform(val => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 30 : Math.min(num, 365);
  })
});

function getSeededNotificationEvents(creatorId: string, windowDays: number): Array<{ type: "sent" | "opened"; date: string }> {
  const hash = creatorId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const seed = hash % 10000;

  const events: Array<{ type: "sent" | "opened"; date: string }> = [];
  const today = new Date("2024-01-01");

  for (let i = 0; i < windowDays; i++) {
    const eventDate = new Date(today);
    eventDate.setDate(eventDate.getDate() + i);
    const dateStr = eventDate.toISOString().split("T")[0];

    const sentCount = 2 + ((seed * 89 + i * 101) % 8);
    const openedCount = Math.floor((sentCount * (40 + ((seed * 73 + i * 137) % 50))) / 100);

    for (let s = 0; s < sentCount; s++) {
      events.push({ type: "sent", date: dateStr });
    }
    for (let o = 0; o < openedCount; o++) {
      events.push({ type: "opened", date: dateStr });
    }
  }

  return events;
}

function computeOpenRate(events: Array<{ type: "sent" | "opened"; date: string }>): NotificationOpenRate {
  let notifications_sent = 0;
  let opened = 0;

  for (const event of events) {
    if (event.type === "sent") {
      notifications_sent += 1;
    } else {
      opened += 1;
    }
  }

  const open_rate_percent = notifications_sent > 0
    ? Math.round((opened / notifications_sent) * 10000) / 100
    : 0;

  return {
    notifications_sent,
    opened,
    open_rate_percent
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
  const events = getSeededNotificationEvents(creator_id, window_days);
  const rate = computeOpenRate(events);

  return NextResponse.json(rate);
}
