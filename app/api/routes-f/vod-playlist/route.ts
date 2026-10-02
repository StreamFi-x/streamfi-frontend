import { NextRequest, NextResponse } from "next/server";
import type { PostPlaylistBody, DeletePlaylistBody } from "./types";
import {
  getPlaylist,
  appendToPlaylist,
  removeFromPlaylist,
} from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const viewerId = req.nextUrl.searchParams.get("viewer_id");

  if (!viewerId) {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  const playlist = getPlaylist(viewerId);
  return NextResponse.json(playlist);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PostPlaylistBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, vod_id } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!vod_id || typeof vod_id !== "string") {
    return NextResponse.json(
      { error: "vod_id is required" },
      { status: 400 }
    );
  }

  try {
    const item = appendToPlaylist(viewer_id, vod_id);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("full") ? 400 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: DeletePlaylistBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, vod_id } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!vod_id || typeof vod_id !== "string") {
    return NextResponse.json(
      { error: "vod_id is required" },
      { status: 400 }
    );
  }

  const removed = removeFromPlaylist(viewer_id, vod_id);
  if (!removed) {
    return NextResponse.json(
      { error: "VOD not found in playlist" },
      { status: 404 }
    );
  }

  return NextResponse.json({ removed: true });
}
