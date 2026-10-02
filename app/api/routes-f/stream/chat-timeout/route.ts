import { NextRequest, NextResponse } from "next/server";
import { applyTimeout, liftTimeout, listActiveTimeouts } from "./store";

const MIN_SECONDS = 1;
const MAX_SECONDS = 86_400;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { stream_id, user_id, seconds, reason } = body;

  if (typeof stream_id !== "string" || !stream_id.trim()) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }
  if (typeof user_id !== "string" || !user_id.trim()) {
    return NextResponse.json(
      { error: "user_id is required." },
      { status: 400 }
    );
  }
  if (typeof seconds !== "number" || !Number.isInteger(seconds)) {
    return NextResponse.json(
      { error: "seconds must be an integer." },
      { status: 400 }
    );
  }
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    return NextResponse.json(
      {
        error: `seconds must be between ${MIN_SECONDS} and ${MAX_SECONDS}.`,
      },
      { status: 400 }
    );
  }
  if (reason !== undefined && typeof reason !== "string") {
    return NextResponse.json(
      { error: "reason must be a string." },
      { status: 400 }
    );
  }

  const result = applyTimeout(
    stream_id as string,
    user_id as string,
    seconds as number,
    reason as string | undefined
  );
  return NextResponse.json(result);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }

  const timeouts = listActiveTimeouts(streamId);
  return NextResponse.json({ stream_id: streamId, timeouts });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { stream_id, user_id } = body;

  if (typeof stream_id !== "string" || !stream_id.trim()) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }
  if (typeof user_id !== "string" || !user_id.trim()) {
    return NextResponse.json(
      { error: "user_id is required." },
      { status: 400 }
    );
  }

  const lifted = liftTimeout(stream_id, user_id);
  return NextResponse.json({ lifted });
}
