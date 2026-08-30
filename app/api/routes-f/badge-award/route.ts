import { NextRequest, NextResponse } from "next/server";
import { modStore } from "../mod-team/route";
import { badgeStore, BadgeType } from "../viewer-badge/route";

const MAX_BADGES = 5;
const VALID_BADGES: BadgeType[] = ["mod", "vip", "og", "founder"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, viewer_id, badge, moderator_id } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }
  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!moderator_id || typeof moderator_id !== "string") {
    return NextResponse.json(
      { error: "moderator_id is required" },
      { status: 400 }
    );
  }
  if (!badge || !VALID_BADGES.includes(badge as BadgeType)) {
    return NextResponse.json(
      { error: `badge must be one of: ${VALID_BADGES.join(", ")}` },
      { status: 400 }
    );
  }

  // Moderator check
  const modKey = `${creator_id}:${moderator_id}`;
  if (!modStore.has(modKey) && creator_id !== moderator_id) {
    return NextResponse.json(
      { error: "Forbidden: Moderator only" },
      { status: 403 }
    );
  }

  const badgeKey = `${creator_id}:${viewer_id}`;
  const existing = badgeStore.get(badgeKey) ?? [];

  if (existing.some((b) => b.badge === badge)) {
    return NextResponse.json(
      { error: `Viewer already has the "${badge}" badge` },
      { status: 409 }
    );
  }

  if (existing.length >= MAX_BADGES) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_BADGES} badges per viewer reached` },
      { status: 422 }
    );
  }

  const granted_at = new Date().toISOString();
  existing.push({
    badge: badge as BadgeType,
    granted_by: moderator_id,
    granted_at,
  });
  badgeStore.set(badgeKey, existing);

  return NextResponse.json({ granted_at }, { status: 201 });
}
