import { NextRequest, NextResponse } from "next/server";
import type { PostPanelBody, GetPanelsResponse } from "./types";
import { getPanelsByCreator, createPanel } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const panels = getPanelsByCreator(creatorId);
  return NextResponse.json({ panels } satisfies GetPanelsResponse);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PostPanelBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, title, body_markdown, image_url } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }
  if (
    !body_markdown ||
    typeof body_markdown !== "string" ||
    body_markdown.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "body_markdown is required" },
      { status: 400 }
    );
  }
  if (image_url !== undefined && typeof image_url !== "string") {
    return NextResponse.json(
      { error: "image_url must be a string" },
      { status: 400 }
    );
  }

  const panel = createPanel(creator_id, title, body_markdown, image_url);
  return NextResponse.json(panel, { status: 201 });
}
