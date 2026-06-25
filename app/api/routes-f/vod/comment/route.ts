import { NextRequest, NextResponse } from "next/server";
import type {
  PostCommentBody,
  PostCommentResponse,
  GetCommentsResponse,
} from "./types";
import {
  findVod,
  addComment,
  getCommentsByVod,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PostCommentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { vod_id, time_seconds, user_id, text } = body;

  if (!vod_id || typeof vod_id !== "string") {
    return NextResponse.json({ error: "vod_id is required" }, { status: 400 });
  }
  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required and must be non-empty" }, { status: 400 });
  }
  if (typeof time_seconds !== "number" || time_seconds < 0) {
    return NextResponse.json(
      { error: "time_seconds must be a non-negative number" },
      { status: 400 }
    );
  }

  // Validate vod exists and time is within duration
  const vod = findVod(vod_id);
  if (!vod) {
    return NextResponse.json({ error: `vod_id '${vod_id}' not found` }, { status: 404 });
  }
  if (time_seconds > vod.duration_seconds) {
    return NextResponse.json(
      {
        error: `time_seconds ${time_seconds} exceeds VOD duration of ${vod.duration_seconds}s`,
      },
      { status: 400 }
    );
  }

  const comment = addComment({ vod_id, user_id, text, time_seconds });

  return NextResponse.json(
    { comment_id: comment.comment_id, created_at: comment.created_at } as PostCommentResponse,
    { status: 201 }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const vodId = searchParams.get("vod_id");
  const nearTimeParam = searchParams.get("near_time");
  const radiusParam = searchParams.get("radius_seconds");

  if (!vodId) {
    return NextResponse.json({ error: "vod_id is required" }, { status: 400 });
  }

  const vod = findVod(vodId);
  if (!vod) {
    return NextResponse.json({ error: `vod_id '${vodId}' not found` }, { status: 404 });
  }

  let comments = getCommentsByVod(vodId);

  // Apply near-time filter if provided
  if (nearTimeParam !== null) {
    const nearTime = parseFloat(nearTimeParam);
    if (isNaN(nearTime) || nearTime < 0) {
      return NextResponse.json(
        { error: "near_time must be a non-negative number" },
        { status: 400 }
      );
    }

    const radius = radiusParam !== null ? parseFloat(radiusParam) : 30;
    if (isNaN(radius) || radius < 0) {
      return NextResponse.json(
        { error: "radius_seconds must be a non-negative number" },
        { status: 400 }
      );
    }

    comments = comments.filter(
      c => Math.abs(c.time_seconds - nearTime) <= radius
    );
  }

  // Sort by timestamp ascending
  comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return NextResponse.json({
    comments,
    total: comments.length,
  } as GetCommentsResponse);
}
