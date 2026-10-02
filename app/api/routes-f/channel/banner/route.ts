import { NextRequest, NextResponse } from "next/server";
import type { GetBannerResponse, PutBannerBody } from "./types";
import { DEFAULT_FOCAL_POINT } from "./types";
import { getBanner, isValidFocalPoint, upsertBanner } from "./store";

/**
 * GET /api/routes-f/channel/banner?creator_id=...
 * Returns the banner_url and focal_point for the creator. Defaults to an
 * empty banner_url and center focal point if no banner has been set yet.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const banner = getBanner(creatorId);
  if (!banner) {
    return NextResponse.json({
      banner_url: "",
      focal_point: DEFAULT_FOCAL_POINT,
    } satisfies GetBannerResponse);
  }

  return NextResponse.json({
    banner_url: banner.banner_url,
    focal_point: banner.focal_point,
  } satisfies GetBannerResponse);
}

/**
 * PUT /api/routes-f/channel/banner
 * Body: { creator_id, banner_url, focal_point? }
 *
 * Validates focal_point.x and y are in [0, 1]. Omitting focal_point preserves
 * the previously stored value (or defaults to {0.5, 0.5}).
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: Partial<PutBannerBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, banner_url, focal_point } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }
  if (!banner_url || typeof banner_url !== "string") {
    return NextResponse.json(
      { error: "banner_url is required" },
      { status: 400 }
    );
  }
  if (focal_point !== undefined && !isValidFocalPoint(focal_point)) {
    return NextResponse.json(
      { error: "focal_point.x and focal_point.y must be numbers in [0, 1]" },
      { status: 400 }
    );
  }

  const updated = upsertBanner(creator_id, banner_url, focal_point);
  return NextResponse.json({
    banner_url: updated.banner_url,
    focal_point: updated.focal_point,
  } satisfies GetBannerResponse);
}
