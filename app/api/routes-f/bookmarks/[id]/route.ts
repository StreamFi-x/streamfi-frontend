import { NextRequest, NextResponse } from "next/server";
import { getBookmark, updateBookmark, deleteBookmark } from "../_lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const bookmark = getBookmark(id);
  if (!bookmark) {
    return NextResponse.json({ error: "Bookmark not found." }, { status: 404 });
  }
  return NextResponse.json({ bookmark });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  let body: { url?: unknown; title?: unknown; description?: unknown; tags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { url, title, description, tags } = body;

  if (url !== undefined) {
    if (typeof url !== "string") {
      return NextResponse.json({ error: "url must be a string." }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "url is not a valid URL." }, { status: 400 });
    }
  }
  if (title !== undefined && typeof title !== "string") {
    return NextResponse.json({ error: "title must be a string." }, { status: 400 });
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

  const updated = updateBookmark(id, {
    ...(url !== undefined && { url: url as string }),
    ...(title !== undefined && { title: title as string }),
    ...(description !== undefined && { description: description as string }),
    ...(tags !== undefined && { tags: tags as string[] }),
  });

  if (!updated) {
    return NextResponse.json({ error: "Bookmark not found." }, { status: 404 });
  }
  return NextResponse.json({ bookmark: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!deleteBookmark(id)) {
    return NextResponse.json({ error: "Bookmark not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
