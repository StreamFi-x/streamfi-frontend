import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { modStore } from "@/app/api/routes-f/mod-team/route";
import { badgeStore, type BadgeType } from "@/app/api/routes-f/viewer-badge/route";

const VALID_BADGES: BadgeType[] = ["mod", "vip", "og", "founder"];

function storeKey(creator_id: string, viewer_id: string): string {
  return `${creator_id}:${viewer_id}`;
}

function isModerator(userId: string, creatorId: string): boolean {
  const key = storeKey(creatorId, userId);
  return modStore.has(key);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, viewer_id, badge } = body as Record<string, unknown>;

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
  if (!badge || typeof badge !== "string" || !VALID_BADGES.includes(badge as BadgeType)) {
    return NextResponse.json(
      { error: `badge must be one of: ${VALID_BADGES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!isModerator(session.userId, creator_id)) {
    return NextResponse.json(
      { error: "Only moderators can revoke badges" },
      { status: 403 }
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
