import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const ALLOWED_EVENTS = ["stream.live", "stream.ended", "tip.received", "follow", "mention"] as const;
type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

type Subscription = {
  subscription_id: string;
  viewer_id: string;
  url: string;
  events: AllowedEvent[];
  secret: string;
  created_at: string;
};

const subscriptions = new Map<string, Subscription>();

function generateId(): string {
  return `wh_${crypto.randomBytes(8).toString("hex")}`;
}

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(16).toString("hex")}`;
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const viewerId = typeof payload.viewer_id === "string" ? payload.viewer_id.trim() : null;
  if (!viewerId) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : null;
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!validateUrl(url)) {
    return NextResponse.json({ error: "url must be a valid HTTPS URL" }, { status: 400 });
  }

  const rawEvents = Array.isArray(payload.events) ? payload.events : [];
  const events = rawEvents.filter((e): e is AllowedEvent =>
    ALLOWED_EVENTS.includes(e as AllowedEvent),
  );
  if (events.length === 0) {
    return NextResponse.json(
      { error: `events must contain at least one valid event: ${ALLOWED_EVENTS.join(", ")}` },
      { status: 400 },
    );
  }

  const subscription_id = generateId();
  const secret = generateSecret();
  const sub: Subscription = {
    subscription_id,
    viewer_id: viewerId,
    url,
    events,
    secret,
    created_at: new Date().toISOString(),
  };
  subscriptions.set(subscription_id, sub);

  return NextResponse.json({ subscription_id, secret }, { status: 201 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");
  if (!viewerId || !viewerId.trim()) {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }

  const results = [...subscriptions.values()]
    .filter((s) => s.viewer_id === viewerId.trim())
    .map(({ subscription_id, url, events, created_at }) => ({
      subscription_id,
      url,
      events,
      created_at,
    }));

  return NextResponse.json({ viewer_id: viewerId.trim(), subscriptions: results });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscription_id");
  if (!subscriptionId || !subscriptionId.trim()) {
    return NextResponse.json({ error: "subscription_id is required" }, { status: 400 });
  }

  if (!subscriptions.has(subscriptionId.trim())) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  subscriptions.delete(subscriptionId.trim());
  return new NextResponse(null, { status: 204 });
}
