import { NextRequest, NextResponse } from "next/server";
import type { PostRerunBody, GetRerunResponse } from "./types";
import { getRerun, setRerun, clearRerun } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PostRerunBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, vod_id, enabled } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }
  if (!vod_id || typeof vod_id !== "string") {
    return NextResponse.json(
      { error: "vod_id is required" },
      { status: 400 }
    );
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 }
    );
  }

  const config = setRerun(creator_id, vod_id, enabled);
  return NextResponse.json({
    rerun_active: config.rerun_active,
    vod_id: config.vod_id,
    started_at: config.started_at,
  } as GetRerunResponse);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const config = getRerun(creatorId);
  if (!config) {
    return NextResponse.json({
      rerun_active: false,
      vod_id: null,
      started_at: null,
    } as GetRerunResponse);
  }

  return NextResponse.json({
    rerun_active: config.rerun_active,
    vod_id: config.vod_id,
    started_at: config.started_at,
  } as GetRerunResponse);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: { creator_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const cleared = clearRerun(creator_id);
  return NextResponse.json({ cleared });
}
