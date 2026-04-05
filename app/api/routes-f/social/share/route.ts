import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

type ShareItemType = "stream" | "clip" | "profile";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeBase62Code(length = 6) {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += BASE62[bytes[i] % BASE62.length];
  }
  return code;
}

async function ensureSocialShareTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS social_share_aliases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(6) NOT NULL UNIQUE,
      item_id TEXT NOT NULL,
      item_type VARCHAR(20) NOT NULL,
      target_path TEXT NOT NULL,
      og_title TEXT NOT NULL,
      og_description TEXT NOT NULL,
      og_image_url TEXT,
      twitter_card TEXT NOT NULL DEFAULT 'summary_large_image',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT social_share_aliases_item_type_check
        CHECK (item_type IN ('stream', 'clip', 'profile'))
    )
  `;
}

async function reserveCode(payload: {
  itemId: string;
  itemType: ShareItemType;
  targetPath: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  twitterCard: string;
}) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = makeBase62Code(6);
    const result = await sql<{ code: string }>`
      INSERT INTO social_share_aliases (
        code,
        item_id,
        item_type,
        target_path,
        og_title,
        og_description,
        og_image_url,
        twitter_card
      )
      SELECT
        ${code},
        ${payload.itemId},
        ${payload.itemType},
        ${payload.targetPath},
        ${payload.ogTitle},
        ${payload.ogDescription},
        ${payload.ogImageUrl},
        ${payload.twitterCard}
      WHERE NOT EXISTS (
        SELECT 1 FROM social_share_aliases WHERE code = ${code}
      )
      RETURNING code
    `;

    if (result.rows.length > 0) {
      return code;
    }
  }

  throw new Error("Failed to generate a unique share code");
}

async function resolveSharePayload(itemId: string, itemType: ShareItemType) {
  if (itemType === "profile") {
    const result = await sql<{
      id: string;
      username: string;
      avatar: string | null;
      bio: string | null;
      creator: Record<string, unknown> | null;
    }>`
      SELECT id, username, avatar, bio, creator
      FROM users
      WHERE id::text = ${itemId} OR LOWER(username) = LOWER(${itemId})
      LIMIT 1
    `;

    const user = result.rows[0];
    if (!user) {
      throw new Error("Profile not found");
    }

    return {
      targetPath: `/${user.username}`,
      ogTitle: `@${user.username} on StreamFi`,
      ogDescription:
        user.bio?.trim() ||
        (typeof user.creator?.description === "string"
          ? user.creator.description
          : `Watch ${user.username} on StreamFi`),
      ogImageUrl: user.avatar || null,
      twitterCard: "summary_large_image",
    };
  }

  if (itemType === "stream") {
    const result = await sql<{
      id: string;
      username: string;
      mux_playback_id: string | null;
      creator: Record<string, unknown> | null;
    }>`
      SELECT id, username, mux_playback_id, creator
      FROM users
      WHERE id::text = ${itemId}
         OR LOWER(username) = LOWER(${itemId})
         OR mux_playback_id = ${itemId}
      LIMIT 1
    `;

    const user = result.rows[0];
    if (!user || !user.mux_playback_id) {
      throw new Error("Stream not found");
    }

    const title =
      (typeof user.creator?.streamTitle === "string" &&
        user.creator.streamTitle.trim()) ||
      `${user.username} on StreamFi`;
    const description =
      (typeof user.creator?.description === "string" &&
        user.creator.description.trim()) ||
      `Watch ${user.username}'s stream on StreamFi`;

    return {
      targetPath: `/${user.username}/watch`,
      ogTitle: title,
      ogDescription: description,
      ogImageUrl: `https://image.mux.com/${user.mux_playback_id}/thumbnail.jpg`,
      twitterCard: "summary_large_image",
    };
  }

  const clipResult = await sql<{
    id: string;
    playback_id: string;
    title: string | null;
    username: string;
  }>`
    SELECT r.id, r.playback_id, r.title, u.username
    FROM stream_recordings r
    JOIN users u ON u.id = r.user_id
    WHERE r.id::text = ${itemId} OR r.playback_id = ${itemId}
    LIMIT 1
  `;

  const clip = clipResult.rows[0];
  if (!clip) {
    throw new Error("Clip not found");
  }

  return {
    targetPath: `/${clip.username}/clips/${clip.id}`,
    ogTitle: clip.title?.trim() || `Clip from ${clip.username}`,
    ogDescription: `Watch this clip from @${clip.username} on StreamFi`,
    ogImageUrl: `https://image.mux.com/${clip.playback_id}/thumbnail.jpg`,
    twitterCard: "summary_large_image",
  };
}

export async function POST(req: NextRequest) {
  try {
    await ensureSocialShareTable();

    const payload = await req.json();
    if (!isRecord(payload)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const itemId = payload.item_id;
    const itemType = payload.item_type;

    if (typeof itemId !== "string" || !itemId.trim()) {
      return NextResponse.json(
        { error: "item_id is required" },
        { status: 400 }
      );
    }

    if (!["stream", "clip", "profile"].includes(String(itemType))) {
      return NextResponse.json(
        { error: "item_type must be stream, clip, or profile" },
        { status: 400 }
      );
    }

    const share = await resolveSharePayload(
      itemId.trim(),
      itemType as ShareItemType
    );
    const code = await reserveCode({
      itemId: itemId.trim(),
      itemType: itemType as ShareItemType,
      ...share,
    });

    return NextResponse.json({
      short_url: `/s/${code}`,
      og_title: share.ogTitle,
      og_description: share.ogDescription,
      og_image_url: share.ogImageUrl,
      twitter_card: share.twitterCard,
    });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[routes-f/social/share] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate share payload" },
      { status: 500 }
    );
  }
}
