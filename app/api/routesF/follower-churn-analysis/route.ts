import { NextResponse } from "next/server";

type FollowEvent = {
  creator_id: string;
  user_id: string;
  action: "follow" | "unfollow";
  happened_at: string;
};

const FOLLOW_EVENTS: FollowEvent[] = [
  {
    creator_id: "creator-alpha",
    user_id: "fan-1",
    action: "follow",
    happened_at: "2026-06-01T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-2",
    action: "follow",
    happened_at: "2026-06-03T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-3",
    action: "follow",
    happened_at: "2026-06-10T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-4",
    action: "follow",
    happened_at: "2026-06-12T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-5",
    action: "follow",
    happened_at: "2026-07-05T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-2",
    action: "unfollow",
    happened_at: "2026-07-12T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-6",
    action: "follow",
    happened_at: "2026-07-20T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-4",
    action: "unfollow",
    happened_at: "2026-07-23T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    user_id: "fan-7",
    action: "follow",
    happened_at: "2026-07-24T00:00:00.000Z",
  },
  {
    creator_id: "creator-beta",
    user_id: "fan-z",
    action: "follow",
    happened_at: "2026-07-24T00:00:00.000Z",
  },
];

function parseWindowDays(value: string | null) {
  if (value === null || value === "") {
    return 30;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function startOfUtcDay(dateString: string) {
  const date = new Date(dateString);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getWindowBounds(eventDates: string[], windowDays: number) {
  const latestDay = eventDates
    .map(startOfUtcDay)
    .reduce((latest, candidate) => (candidate > latest ? candidate : latest));

  const windowStart = addUtcDays(latestDay, -(windowDays - 1));
  return { windowStart, windowEnd: latestDay };
}

function countFollowers(events: FollowEvent[]) {
  const followers = new Set<string>();

  for (const event of events) {
    if (event.action === "follow") {
      followers.add(event.user_id);
    } else {
      followers.delete(event.user_id);
    }
  }

  return followers.size;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get("creator_id");
  const windowDays = parseWindowDays(searchParams.get("window_days"));

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required." },
      { status: 400 }
    );
  }

  if (windowDays === null) {
    return NextResponse.json(
      { error: "window_days must be a positive integer." },
      { status: 400 }
    );
  }

  const creatorEvents = FOLLOW_EVENTS.filter(
    event => event.creator_id === creatorId
  );

  if (creatorEvents.length === 0) {
    return NextResponse.json({
      starting_followers: 0,
      gained: 0,
      lost: 0,
      ending: 0,
      churn_rate_percent: 0,
    });
  }

  const eventDates = creatorEvents.map(event => event.happened_at);
  const { windowStart, windowEnd } = getWindowBounds(eventDates, windowDays);

  const startingEvents = creatorEvents.filter(event => {
    const occurredAt = startOfUtcDay(event.happened_at);
    return occurredAt < windowStart;
  });
  const windowEvents = creatorEvents.filter(event => {
    const occurredAt = startOfUtcDay(event.happened_at);
    return occurredAt >= windowStart && occurredAt <= windowEnd;
  });

  const starting_followers = countFollowers(startingEvents);
  const gained = windowEvents.filter(event => event.action === "follow").length;
  const lost = windowEvents.filter(event => event.action === "unfollow").length;
  const ending = starting_followers + gained - lost;
  const churn_rate_percent =
    starting_followers === 0 ? 0 : (lost / starting_followers) * 100;

  return NextResponse.json({
    starting_followers,
    gained,
    lost,
    ending,
    churn_rate_percent,
  });
}
