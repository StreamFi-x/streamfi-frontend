import { NextRequest, NextResponse } from "next/server";
import type { GetAboutResponse, PutAboutBody } from "./types";
import { MAX_ABOUT_BYTES } from "./types";
import { getAbout, upsertAbout, byteLength } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const about = getAbout(creatorId);
  if (!about) {
    return NextResponse.json({
      about_markdown: "",
      last_updated: null,
    });
  }

  return NextResponse.json({
    about_markdown: about.about_markdown,
    last_updated: about.last_updated,
  } satisfies GetAboutResponse);
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: PutAboutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, about_markdown } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }
  if (typeof about_markdown !== "string") {
    return NextResponse.json(
      { error: "about_markdown is required and must be a string" },
      { status: 400 }
    );
  }

  if (byteLength(about_markdown) > MAX_ABOUT_BYTES) {
    return NextResponse.json(
      { error: "about_markdown exceeds maximum size of 50KB" },
      { status: 400 }
    );
  }

  const updated = upsertAbout(creator_id, about_markdown);
  return NextResponse.json({
    about_markdown: updated.about_markdown,
    last_updated: updated.last_updated,
  });
}
