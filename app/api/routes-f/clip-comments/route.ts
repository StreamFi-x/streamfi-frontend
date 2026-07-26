import { NextRequest, NextResponse } from "next/server";

export interface ClipComment {
  comment_id: string;
  clip_id: string;
  author: string;
  text: string;
  parent_comment_id: string | null;
  created_at: string;
}

// In-memory store for clip comments, keyed by comment_id (insertion order preserved)
export const CLIP_COMMENTS: Record<string, ClipComment> = {};

let commentCounter = 0;

const DEFAULT_PAGE_SIZE = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clip_id, author, text, parent_comment_id } = body;

    if (!clip_id || typeof clip_id !== "string") {
      return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
    }
    if (!author || typeof author !== "string") {
      return NextResponse.json({ error: "author is required" }, { status: 400 });
    }
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (parent_comment_id !== undefined && parent_comment_id !== null) {
      const parent = CLIP_COMMENTS[parent_comment_id];
      if (!parent) {
        return NextResponse.json({ error: "parent_comment_id not found" }, { status: 404 });
      }
      if (parent.clip_id !== clip_id) {
        return NextResponse.json(
          { error: "parent_comment_id belongs to a different clip" },
          { status: 400 }
        );
      }
      // Depth is capped at 1: replies to replies are rejected
      if (parent.parent_comment_id !== null) {
        return NextResponse.json(
          { error: "Cannot reply to a reply (max depth is 1)" },
          { status: 400 }
        );
      }
    }

    commentCounter += 1;
    const comment: ClipComment = {
      comment_id: `comment-${commentCounter}`,
      clip_id,
      author,
      text: text.trim(),
      parent_comment_id: parent_comment_id ?? null,
      created_at: new Date().toISOString(),
    };
    CLIP_COMMENTS[comment.comment_id] = comment;

    return NextResponse.json({ comment_id: comment.comment_id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  let limit = DEFAULT_PAGE_SIZE;
  if (limitParam !== null) {
    limit = Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "limit must be an integer between 1 and 100" },
        { status: 400 }
      );
    }
  }

  const all = Object.values(CLIP_COMMENTS);
  const topLevel = all.filter((c) => c.clip_id === clipId && c.parent_comment_id === null);

  let startIndex = 0;
  if (cursor !== null) {
    const cursorIndex = topLevel.findIndex((c) => c.comment_id === cursor);
    if (cursorIndex === -1) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    startIndex = cursorIndex + 1;
  }

  const page = topLevel.slice(startIndex, startIndex + limit);
  const comments = page.map((c) => ({
    ...c,
    reply_count: all.filter((r) => r.parent_comment_id === c.comment_id).length,
  }));

  const hasMore = startIndex + limit < topLevel.length;
  const nextCursor = hasMore ? page[page.length - 1].comment_id : null;

  return NextResponse.json({
    comments,
    next_cursor: nextCursor,
    has_more: hasMore,
  });
}
