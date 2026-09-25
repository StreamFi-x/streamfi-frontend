import { NextResponse } from "next/server";

type ViewEvent = {
  creator_id: string;
  viewer_id: string;
  viewed_at: string;
};

type SubEvent = {
  creator_id: string;
  viewer_id: string;
  subscribed_at: string;
};

const VIEW_EVENTS: ViewEvent[] = [
  {
    creator_id: "creator-alpha",
    viewer_id: "ava",
    viewed_at: "2026-07-01T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    viewer_id: "ben",
    viewed_at: "2026-07-02T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    viewer_id: "ava",
    viewed_at: "2026-07-03T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    viewer_id: "chloe",
    viewed_at: "2026-07-21T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    viewer_id: "dan",
    viewed_at: "2026-07-23T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    viewer_id: "erica",
    viewed_at: "2026-07-24T00:00:00.000Z",
  },
  {
    creator_id: "creator-beta",
    viewer_id: "zoe",
    viewed_at: "2026-07-24T00:00:00.000Z",
  },
];

const SUB_EVENTS: SubEvent[] = [
  {
    creator_id: "creator-alpha",
    viewer_id: "ava",
    subscribed_at: "2026-07-22T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    viewer_id: "erica",
    subscribed_at: "2026-07-24T00:00:00.000Z",
  },
  {
    creator_id: "creator-alpha",
    viewer_id: "frank",
    subscribed_at: "2026-06-10T00:00:00.000Z",
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

function uniqueIds<T extends { viewer_id: string }>(events: T[]) {
  return new Set(events.map(event => event.viewer_id));
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

  const creatorViews = VIEW_EVENTS.filter(
    event => event.creator_id === creatorId
  );
  const creatorSubs = SUB_EVENTS.filter(event => event.creator_id === creatorId);

  if (creatorViews.length === 0 && creatorSubs.length === 0) {
    return NextResponse.json({
      total_viewers: 0,
      new_subs: 0,
      conversion_percent: 0,
    });
  }

  const eventDates = [...creatorViews, ...creatorSubs].map(
    event => "viewed_at" in event ? event.viewed_at : event.subscribed_at
  );
  const { windowStart, windowEnd } = getWindowBounds(eventDates, windowDays);

  const windowedViews = creatorViews.filter(event => {
    const viewedAt = startOfUtcDay(event.viewed_at);
    return viewedAt >= windowStart && viewedAt <= windowEnd;
  });

  const windowedSubs = creatorSubs.filter(event => {
    const subscribedAt = startOfUtcDay(event.subscribed_at);
    return subscribedAt >= windowStart && subscribedAt <= windowEnd;
  });

  const total_viewers = uniqueIds(windowedViews).size;
  const new_subs = uniqueIds(windowedSubs).size;
  const conversion_percent =
    total_viewers === 0 ? 0 : (new_subs / total_viewers) * 100;

  return NextResponse.json({
    total_viewers,
    new_subs,
    conversion_percent,
  });
}
