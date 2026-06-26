import { NextRequest, NextResponse } from "next/server";
import type { GetSocialLinksResponse, PutSocialLinksBody } from "./types";
import { MAX_SOCIAL_LINKS } from "./types";
import { getSocialLinks, setSocialLinks, isValidUrl } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const links = getSocialLinks(creatorId);
  return NextResponse.json({ links } satisfies GetSocialLinksResponse);
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: PutSocialLinksBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, links } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(links)) {
    return NextResponse.json(
      { error: "links must be an array" },
      { status: 400 }
    );
  }
  if (links.length > MAX_SOCIAL_LINKS) {
    return NextResponse.json(
      { error: `Cannot exceed ${MAX_SOCIAL_LINKS} social links` },
      { status: 400 }
    );
  }

  for (const link of links) {
    if (!link || typeof link !== "object") {
      return NextResponse.json(
        { error: "Each link must be an object with platform and url" },
        { status: 400 }
      );
    }
    if (!link.platform || typeof link.platform !== "string") {
      return NextResponse.json(
        { error: "Each link must have a platform string" },
        { status: 400 }
      );
    }
    if (!link.url || typeof link.url !== "string") {
      return NextResponse.json(
        { error: "Each link must have a url string" },
        { status: 400 }
      );
    }
    if (!isValidUrl(link.url)) {
      return NextResponse.json(
        { error: `Invalid URL for platform '${link.platform}': ${link.url}` },
        { status: 400 }
      );
    }
  }

  const saved = setSocialLinks(creator_id, links);
  return NextResponse.json({ links: saved });
}
