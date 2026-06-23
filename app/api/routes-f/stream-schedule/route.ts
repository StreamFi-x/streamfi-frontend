import { NextRequest, NextResponse } from "next/server";

// In-memory store for scheduled stream ends
const scheduleStore = new Map<
  string,
  {
    stream_id: string;
    end_at: string;
    scheduled: boolean;
    fires_in_seconds: number;
  }
>();

function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString() === dateString;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const schedule = scheduleStore.get(streamId);

  if (!schedule) {
    return NextResponse.json(
      { error: "No schedule found for stream" },
      { status: 404 }
    );
  }

  return NextResponse.json(schedule);
}

export async function POST(req: NextRequest) {
  let body: {
    stream_id?: unknown;
    end_at?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stream_id, end_at } = body;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required and must be a string" },
      { status: 400 }
    );
  }

  if (!end_at || typeof end_at !== "string") {
    return NextResponse.json(
      { error: "end_at is required and must be a string" },
      { status: 400 }
    );
  }

  if (!isValidISODate(end_at)) {
    return NextResponse.json(
      { error: "end_at must be a valid ISO 8601 date string" },
      { status: 400 }
    );
  }

  const endTime = new Date(end_at);
  const now = new Date();

  if (endTime <= now) {
    return NextResponse.json(
      { error: "end_at must be in the future" },
      { status: 400 }
    );
  }

  const firesInSeconds = Math.floor((endTime.getTime() - now.getTime()) / 1000);

  const schedule = {
    stream_id,
    end_at,
    scheduled: true,
    fires_in_seconds: firesInSeconds,
  };

  scheduleStore.set(stream_id, schedule);

  return NextResponse.json(schedule, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  let body: { stream_id?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stream_id } = body;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required and must be a string" },
      { status: 400 }
    );
  }

  const existed = scheduleStore.delete(stream_id);

  if (!existed) {
    return NextResponse.json(
      { error: "No schedule found for stream" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
