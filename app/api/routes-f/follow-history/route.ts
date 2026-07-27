import { NextRequest, NextResponse } from "next/server";

type FollowAction = "follow" | "unfollow";

type FollowEvent = {
  creator: string;
  action: FollowAction;
  ts: string;
};

const SEED_CREATORS = [
  "creator_alpha",
  "creator_beta",
  "creator_gamma",
  "creator_delta",
  "creator_epsilon",
  "creator_zeta",
];

function seedFollowHistory(viewerId: string): FollowEvent[] {
  const hash = viewerId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const events: FollowEvent[] = [];
  const base = new Date("2025-01-01T00:00:00Z").getTime();

  SEED_CREATORS.forEach((creator, i) => {
    const followTs = new Date(base + (hash * 13 + i * 17) % (180 * 86_400_000)).toISOString();
    events.push({ creator, action: "follow", ts: followTs });

    // Some creators also get an unfollow event.
    if ((hash + i) % 3 === 0) {
      const unfollowTs = new Date(
        new Date(followTs).getTime() + (7 + (hash % 14)) * 86_400_000,
      ).toISOString();
      events.push({ creator, action: "unfollow", ts: unfollowTs });
    }
  });

  events.sort((a, b) => b.ts.localeCompare(a.ts));
  return events;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");
  if (!viewerId || !viewerId.trim()) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = parseInt(rawLimit, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_LIMIT}` },
        { status: 400 },
      );
    }
    limit = parsed;
  }

  const history = seedFollowHistory(viewerId.trim());
  return NextResponse.json({ viewer_id: viewerId.trim(), history: history.slice(0, limit) });
}
