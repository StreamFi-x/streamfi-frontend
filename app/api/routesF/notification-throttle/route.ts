import { NextRequest, NextResponse } from "next/server";

const THROTTLE_WINDOW_MS = 30 * 60 * 1_000; // 30 minutes

type ThrottleRecord = {
  lastSentAt: number;
};

// In-memory store: key = `${viewer_id}::${creator_id}`
const throttleStore = new Map<string, ThrottleRecord>();

function makeKey(viewerId: string, creatorId: string): string {
  return `${viewerId}::${creatorId}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(req.url);
  const isConsume = pathname.endsWith("/consume");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const viewerId = typeof payload.viewer_id === "string" ? payload.viewer_id.trim() : null;
  const creatorId = typeof payload.creator_id === "string" ? payload.creator_id.trim() : null;

  if (!viewerId) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }
  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const key = makeKey(viewerId, creatorId);
  const now = Date.now();
  const record = throttleStore.get(key);

  if (isConsume) {
    throttleStore.set(key, { lastSentAt: now });
    return NextResponse.json({ consumed: true, next_allowed_at: new Date(now + THROTTLE_WINDOW_MS).toISOString() });
  }

  // /check path
  if (record && now - record.lastSentAt < THROTTLE_WINDOW_MS) {
    const next_allowed_at = new Date(record.lastSentAt + THROTTLE_WINDOW_MS).toISOString();
    return NextResponse.json({ allowed: false, next_allowed_at });
  }

  return NextResponse.json({ allowed: true });
}
