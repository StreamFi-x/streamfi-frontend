import { NextRequest, NextResponse } from "next/server";

const MAX_WEEKLY_QUOTA = 3;
const MESSAGE_MAX_LENGTH = 500;

type WeeklyUsage = {
  weekKey: string;
  used: number;
};

// In-memory store: key = creator_id
const usageStore = new Map<string, WeeklyUsage>();

function currentWeekKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const dayOfYear = Math.floor((now.getTime() - new Date(year, 0, 0).getTime()) / 86_400_000);
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getUsage(creatorId: string): WeeklyUsage {
  const weekKey = currentWeekKey();
  const stored = usageStore.get(creatorId);
  if (!stored || stored.weekKey !== weekKey) {
    return { weekKey, used: 0 };
  }
  return stored;
}

const SEED_SUBSCRIBER_COUNT: Record<string, number> = {
  "creator-001": 1200,
  "creator-002": 450,
  "creator-003": 8900,
};

function getSubscriberCount(creatorId: string): number {
  if (SEED_SUBSCRIBER_COUNT[creatorId]) return SEED_SUBSCRIBER_COUNT[creatorId];
  const hash = creatorId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 100 + (hash % 4900);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  if (!creatorId || !creatorId.trim()) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const usage = getUsage(creatorId.trim());
  const remaining_quota_this_week = Math.max(0, MAX_WEEKLY_QUOTA - usage.used);

  return NextResponse.json({
    creator_id: creatorId.trim(),
    quota: MAX_WEEKLY_QUOTA,
    used_this_week: usage.used,
    remaining_quota_this_week,
    week: usage.weekKey,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const creatorId = typeof payload.creator_id === "string" ? payload.creator_id.trim() : null;
  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : null;
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `message must be at most ${MESSAGE_MAX_LENGTH} characters` },
      { status: 400 },
    );
  }

  const usage = getUsage(creatorId);
  if (usage.used >= MAX_WEEKLY_QUOTA) {
    return NextResponse.json(
      {
        error: `Weekly priority notification quota (${MAX_WEEKLY_QUOTA}) exceeded`,
        quota: MAX_WEEKLY_QUOTA,
        used_this_week: usage.used,
        remaining_quota_this_week: 0,
      },
      { status: 429 },
    );
  }

  usage.used += 1;
  usageStore.set(creatorId, usage);

  const notified_count = getSubscriberCount(creatorId);
  return NextResponse.json(
    {
      notified_count,
      remaining_quota_this_week: MAX_WEEKLY_QUOTA - usage.used,
      week: usage.weekKey,
    },
    { status: 200 },
  );
}
