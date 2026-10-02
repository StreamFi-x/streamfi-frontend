import { NextRequest, NextResponse } from "next/server";
import type { PostCoverBody, PostCoverResponse, GetCoverResponse } from "./types";
import { getCover, setCover } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PostCoverBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { stream_id, cover_url } = body;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }
  if (!cover_url || typeof cover_url !== "string") {
    return NextResponse.json(
      { error: "cover_url is required" },
      { status: 400 }
    );
  }

  try {
    new URL(cover_url);
  } catch {
    return NextResponse.json(
      { error: "cover_url must be a valid URL" },
      { status: 400 }
    );
  }

  const record = setCover(stream_id, cover_url);
  return NextResponse.json(
    { updated_at: record.updated_at } as PostCoverResponse,
    { status: 200 }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = req.nextUrl.searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const record = getCover(streamId);
  if (!record) {
    return NextResponse.json(
      { error: "No cover image set for this stream" },
      { status: 404 }
    );
  }

  return NextResponse.json(record as GetCoverResponse);
}
