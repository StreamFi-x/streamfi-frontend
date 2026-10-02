/**
 * POST   /api/routes-f/viewer-badge  → grant badge
 * DELETE /api/routes-f/viewer-badge  → revoke badge
 * GET    /api/routes-f/viewer-badge?creator_id=&viewer_id= → list active badges
 */
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type BadgeType = "mod" | "vip" | "og" | "founder";

export interface ViewerBadge {
  badge: BadgeType;
  granted_by: string;
  granted_at: string;
}

// Key: `${creator_id}:${viewer_id}`
export const badgeStore = new Map<string, ViewerBadge[]>();

const MAX_BADGES = 5;
const VALID_BADGES: BadgeType[] = ["mod", "vip", "og", "founder"];

function storeKey(creator_id: string, viewer_id: string) {
  return `${creator_id}:${viewer_id}`;
}

// ---------------------------------------------------------------------------
// GET — list active badges
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creator_id = searchParams.get("creator_id");
  const viewer_id = searchParams.get("viewer_id");

  if (!creator_id || !viewer_id) {
    return NextResponse.json(
      { error: "creator_id and viewer_id are required" },
      { status: 400 }
    );
  }

  const badges = badgeStore.get(storeKey(creator_id, viewer_id)) ?? [];
  return NextResponse.json({ badges });
}

// ---------------------------------------------------------------------------
// POST — grant badge
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, viewer_id, badge, granted_by } = body as Record<string, unknown>;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }
  if (!badge || !VALID_BADGES.includes(badge as BadgeType)) {
    return NextResponse.json(
      { error: `badge must be one of: ${VALID_BADGES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!granted_by || typeof granted_by !== "string") {
    return NextResponse.json({ error: "granted_by is required" }, { status: 400 });
  }

  const key = storeKey(creator_id, viewer_id);
  const existing = badgeStore.get(key) ?? [];

  // Check for duplicate
  if (existing.some((b) => b.badge === badge)) {
    return NextResponse.json(
      { error: `Viewer already has the "${badge}" badge` },
      { status: 409 }
    );
  }

  // Enforce cap
  if (existing.length >= MAX_BADGES) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_BADGES} badges per viewer reached` },
      { status: 422 }
    );
  }

  const granted_at = new Date().toISOString();
  existing.push({ badge: badge as BadgeType, granted_by: granted_by as string, granted_at });
  badgeStore.set(key, existing);

  return NextResponse.json({ granted_at }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE — revoke badge
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, viewer_id, badge } = body as Record<string, unknown>;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }
  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json({ error: "viewer_id is required" }, { status: 400 });
  }
  if (!badge || !VALID_BADGES.includes(badge as BadgeType)) {
    return NextResponse.json(
      { error: `badge must be one of: ${VALID_BADGES.join(", ")}` },
      { status: 400 }
    );
  }

  const key = storeKey(creator_id, viewer_id);
  const existing = badgeStore.get(key) ?? [];
  const idx = existing.findIndex((b) => b.badge === badge);

  if (idx === -1) {
    return NextResponse.json(
      { error: `Viewer does not have the "${badge}" badge` },
      { status: 404 }
    );
  }

  existing.splice(idx, 1);
  badgeStore.set(key, existing);

  return NextResponse.json({ revoked: true });
}
