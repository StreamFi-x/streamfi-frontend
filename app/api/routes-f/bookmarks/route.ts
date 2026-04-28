import { NextRequest, NextResponse } from "next/server";
import { listBookmarks, createBookmark } from "./_lib/store";
import type { SortField } from "./_lib/types";

const VALID_SORTS: SortField[] = ["created", "title"];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tag = searchParams.get("tag") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const sort = (searchParams.get("sort") ?? "created") as SortField;

  if (!VALID_SORTS.includes(sort)) {
    return NextResponse.json(
      { error: `sort must be one of: ${VALID_SORTS.join(", ")}` },
      { status: 400 }
    );
  }

  const items = listBookmarks(tag, q, sort);
  return NextResponse.json({ bookmarks: items, count: items.length });
}

export async function POST(req: NextRequest) {
  let body: { url?: unknown; title?: unknown; description?: unknown; tags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { url, title, description, tags } = body;

  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "url is required and must be a string." }, { status: 400 });
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "url is not a valid URL." }, { status: 400 });
  }
  if (typeof title !== "string" || !title) {
    return NextResponse.json({ error: "title is required and must be a non-empty string." }, { status: 400 });
  }
  if (description !== undefined && typeof description !== "string") {
    return NextResponse.json({ error: "description must be a string." }, { status: 400 });
  }
  if (
    tags !== undefined &&
    (!Array.isArray(tags) || (tags as unknown[]).some((t) => typeof t !== "string"))
  ) {
    return NextResponse.json({ error: "tags must be an array of strings." }, { status: 400 });
  }

  const bookmark = createBookmark({
    url,
    title,
    description: description as string | undefined,
    tags: tags as string[] | undefined,
  });

  if (!bookmark) {
    return NextResponse.json(
      { error: "Bookmark storage is full (max 1000)." },
      { status: 507 }
    );
  }

  return NextResponse.json({ bookmark }, { status: 201 });
}
