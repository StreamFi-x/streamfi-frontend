import { NextRequest, NextResponse } from "next/server";
import type {
  PostBookmarkBody,
  PostBookmarkResponse,
  GetBookmarksResponse,
  DeleteBookmarkBody,
} from "./types";
import {
  createBookmark,
  getBookmarksByViewer,
  deleteBookmark,
} from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const viewerId = req.nextUrl.searchParams.get("viewer_id");

  if (!viewerId) {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  const bookmarks = getBookmarksByViewer(viewerId);
  return NextResponse.json({ bookmarks } satisfies GetBookmarksResponse);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PostBookmarkBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, stream_id, time_seconds, label } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }
  if (typeof time_seconds !== "number" || time_seconds < 0) {
    return NextResponse.json(
      { error: "time_seconds must be a non-negative number" },
      { status: 400 }
    );
  }
  if (label !== undefined && typeof label !== "string") {
    return NextResponse.json(
      { error: "label must be a string" },
      { status: 400 }
    );
  }

  const bookmark = createBookmark(
    viewer_id,
    stream_id,
    time_seconds,
    label
  );

  return NextResponse.json(
    { bookmark_id: bookmark.bookmark_id } satisfies PostBookmarkResponse,
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: DeleteBookmarkBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, bookmark_id } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!bookmark_id || typeof bookmark_id !== "string") {
    return NextResponse.json(
      { error: "bookmark_id is required" },
      { status: 400 }
    );
  }

  const removed = deleteBookmark(viewer_id, bookmark_id);
  if (!removed) {
    return NextResponse.json(
      { error: "Bookmark not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ removed: true });
}
