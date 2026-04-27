import { NextRequest, NextResponse } from "next/server";
import { ingest, buildEvent, getPage } from "./_lib/buffer";

const MAX_BATCH = 100;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function validateRaw(raw: unknown): { name: string; timestamp: string; properties?: Record<string, unknown> } | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Event must be an object";
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || r.name.trim() === "") return "'name' is required and must be a non-empty string";
  if (typeof r.timestamp !== "string" || r.timestamp.trim() === "") return "'timestamp' is required and must be a string";
  if (r.properties !== undefined && (typeof r.properties !== "object" || Array.isArray(r.properties))) {
    return "'properties' must be an object if provided";
  }
  return { name: r.name.trim(), timestamp: r.timestamp.trim(), properties: r.properties as Record<string, unknown> | undefined };
}

// POST /api/routes-f/events
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEvents: unknown[] = body.events !== undefined
    ? Array.isArray(body.events) ? body.events : [body.events]
    : body.event !== undefined
      ? [body.event]
      : [];

  if (rawEvents.length === 0) {
    return NextResponse.json({ error: "Request must include 'event' or 'events'" }, { status: 400 });
  }
  if (rawEvents.length > MAX_BATCH) {
    return NextResponse.json({ error: `Batch size exceeds maximum of ${MAX_BATCH}` }, { status: 400 });
  }

  const validated: { name: string; timestamp: string; properties?: Record<string, unknown> }[] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const result = validateRaw(rawEvents[i]);
    if (typeof result === "string") {
      return NextResponse.json({ error: `Event at index ${i}: ${result}` }, { status: 400 });
    }
    validated.push(result);
  }

  const events = validated.map(buildEvent);
  ingest(events);

  return NextResponse.json({ ingested: events.length, ids: events.map((e) => e.id) }, { status: 201 });
}

// GET /api/routes-f/events?page=1&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  return NextResponse.json(getPage(page, limit));
}
