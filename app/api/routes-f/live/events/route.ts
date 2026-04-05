import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StreamEventType =
  | "raid_in"
  | "raid_out"
  | "gift_sent"
  | "subscription"
  | "stream_start"
  | "stream_end";

const EVENT_TYPE_GROUPS: Record<string, StreamEventType[]> = {
  all: [
    "raid_in",
    "raid_out",
    "gift_sent",
    "subscription",
    "stream_start",
    "stream_end",
  ],
  raid: ["raid_in", "raid_out"],
  gift: ["gift_sent"],
  sub: ["subscription"],
};

interface StreamEvent {
  id: string;
  stream_id: string;
  type: StreamEventType;
  payload: Record<string, unknown>;
  timestamp: string; // ISO-8601
}

// ── In-memory store ───────────────────────────────────────────────────────────
// Maps stream_id → StreamEvent[] (chronological order, capped at 500 per stream)
const MAX_EVENTS_PER_STREAM = 500;
const eventStore = new Map<string, StreamEvent[]>();

let _counter = 0;
function nextId(): string {
  return `evt_${Date.now()}_${(++_counter).toString(36)}`;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function verifyInternalSecret(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    // Not configured — block all POST calls in production, warn in dev
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    console.warn(
      "[events] INTERNAL_SECRET not set — allowing POST in dev only"
    );
    return true;
  }

  const header = req.headers.get("x-internal-secret");
  if (!header) {
    return false;
  }

  try {
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    // Lengths must match for timingSafeEqual
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Rate limiter (GET only — POST is internal) ────────────────────────────────
const isRateLimited = createRateLimiter(60_000, 120);

// ── GET /api/routes-f/live/events?stream_id=&type=all|raid|gift|sub ──────────
// Returns stream lifecycle events in chronological order.
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = req.nextUrl;
  const streamId = searchParams.get("stream_id");
  const typeFilter = (searchParams.get("type") ?? "all").toLowerCase();

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const allowedTypes = EVENT_TYPE_GROUPS[typeFilter];
  if (!allowedTypes) {
    return NextResponse.json(
      {
        error: `Invalid type. Must be one of: ${Object.keys(EVENT_TYPE_GROUPS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const all = eventStore.get(streamId) ?? [];
  const events =
    typeFilter === "all" ? all : all.filter(e => allowedTypes.includes(e.type));

  return NextResponse.json({ events }, { status: 200 });
}

// ── POST /api/routes-f/live/events ───────────────────────────────────────────
// Internal: record a stream lifecycle event.
// Requires X-Internal-Secret header matching INTERNAL_SECRET env var.
export async function POST(req: NextRequest) {
  if (!verifyInternalSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    stream_id?: string;
    type?: string;
    payload?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stream_id, type, payload = {} } = body;

  if (!stream_id || !type) {
    return NextResponse.json(
      { error: "stream_id and type are required" },
      { status: 400 }
    );
  }

  const validTypes = EVENT_TYPE_GROUPS["all"];
  if (!validTypes.includes(type as StreamEventType)) {
    return NextResponse.json(
      { error: `Invalid event type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const event: StreamEvent = {
    id: nextId(),
    stream_id,
    type: type as StreamEventType,
    payload,
    timestamp: new Date().toISOString(),
  };

  const existing = eventStore.get(stream_id) ?? [];
  existing.push(event);

  // Cap per-stream history to avoid unbounded memory growth
  if (existing.length > MAX_EVENTS_PER_STREAM) {
    existing.splice(0, existing.length - MAX_EVENTS_PER_STREAM);
  }

  eventStore.set(stream_id, existing);

  return NextResponse.json({ ok: true, event }, { status: 201 });
}
