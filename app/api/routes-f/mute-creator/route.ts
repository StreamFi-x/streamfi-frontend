import { NextRequest, NextResponse } from "next/server";
import { muteCreator, unmuteCreator, listMutedCreators } from "./_lib/store";

// GET /api/routes-f/mute-creator?follower_id=<id>
export async function GET(req: NextRequest) {
  const followerId = req.nextUrl.searchParams.get("follower_id");

  if (!followerId || followerId.trim().length === 0) {
    return NextResponse.json(
      { error: "follower_id query parameter is required." },
      { status: 400 },
    );
  }

  const muted = listMutedCreators(followerId.trim());
  return NextResponse.json({ muted, count: muted.length });
}

// POST /api/routes-f/mute-creator
// Body: { follower_id, creator_id }
export async function POST(req: NextRequest) {
  let body: { follower_id?: unknown; creator_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { follower_id, creator_id } = body;

  if (typeof follower_id !== "string" || follower_id.trim().length === 0) {
    return NextResponse.json(
      { error: "follower_id is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  if (typeof creator_id !== "string" || creator_id.trim().length === 0) {
    return NextResponse.json(
      { error: "creator_id is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  const result = muteCreator(follower_id.trim(), creator_id.trim());

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ muted_at: result.record.muted_at }, { status: 201 });
}

// DELETE /api/routes-f/mute-creator
// Body: { follower_id, creator_id }
export async function DELETE(req: NextRequest) {
  let body: { follower_id?: unknown; creator_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { follower_id, creator_id } = body;

  if (typeof follower_id !== "string" || follower_id.trim().length === 0) {
    return NextResponse.json(
      { error: "follower_id is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  if (typeof creator_id !== "string" || creator_id.trim().length === 0) {
    return NextResponse.json(
      { error: "creator_id is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  const result = unmuteCreator(follower_id.trim(), creator_id.trim());

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: "Creator unmuted successfully." });
}
