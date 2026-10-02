import { NextRequest, NextResponse } from "next/server";
import { pinMessage, unpinMessage, getPinnedMessage } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { stream_id, message_id, message_text, pinned_by, expires_at } = body;

  if (typeof stream_id !== "string" || !stream_id.trim()) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }
  if (typeof message_id !== "string" || !message_id.trim()) {
    return NextResponse.json(
      { error: "message_id is required." },
      { status: 400 }
    );
  }
  if (typeof message_text !== "string" || !message_text.trim()) {
    return NextResponse.json(
      { error: "message_text is required." },
      { status: 400 }
    );
  }
  if (typeof pinned_by !== "string" || !pinned_by.trim()) {
    return NextResponse.json(
      { error: "pinned_by is required." },
      { status: 400 }
    );
  }

  let expiresAtStr: string | undefined;
  if (expires_at !== undefined) {
    if (typeof expires_at !== "string") {
      return NextResponse.json(
        { error: "expires_at must be a valid ISO date string." },
        { status: 400 }
      );
    }
    const d = new Date(expires_at);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "expires_at must be a valid ISO date string." },
        { status: 400 }
      );
    }
    expiresAtStr = expires_at;
  }

  const pin = pinMessage(
    stream_id as string,
    message_id as string,
    message_text as string,
    pinned_by as string,
    expiresAtStr
  );

  return NextResponse.json({
    pinned_at: pin.pinned_at,
    ...(pin.expires_at ? { expires_at: pin.expires_at } : {}),
  });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }

  unpinMessage(streamId);
  return NextResponse.json({ unpinned: true });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required." },
      { status: 400 }
    );
  }

  const pin = getPinnedMessage(streamId);
  return NextResponse.json({ pin });
}
