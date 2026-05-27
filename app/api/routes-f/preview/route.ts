import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSnapshot } from "./_lib/store";

type PreviewType = "mux_auto" | "mux_snapshot" | "custom" | "placeholder";

function buildMuxAutoUrl(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=5`;
}

function buildPlaceholderUrl(req: NextRequest, username: string) {
  const url = new URL("/api/routes-f/preview/placeholder", req.url);
  url.searchParams.set("username", username);
  return url.toString();
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams
    .get("username")
    ?.trim()
    .toLowerCase();
  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      SELECT username, is_live, mux_playback_id, creator
      FROM users
      WHERE LOWER(username) = ${username}
      LIMIT 1
    `;

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const creator = (user.creator ?? {}) as Record<string, unknown>;
    const customUrl =
      typeof creator.customThumbnailUrl === "string"
        ? creator.customThumbnailUrl
        : null;
    const isLive = Boolean(user.is_live);
    const playbackId =
      typeof user.mux_playback_id === "string" ? user.mux_playback_id : "";

    let type: PreviewType;
    let url: string;
    let generatedAt: string;

    if (customUrl) {
      type = "custom";
      url = customUrl;
      generatedAt =
        typeof creator.customThumbnailUpdatedAt === "string"
          ? creator.customThumbnailUpdatedAt
          : new Date().toISOString();
    } else if (isLive && playbackId) {
      const snapshot = getSnapshot(playbackId);
      if (snapshot) {
        type = "mux_snapshot";
        url = snapshot.url;
        generatedAt = snapshot.generatedAt;
      } else {
        type = "mux_auto";
        url = buildMuxAutoUrl(playbackId);
        generatedAt = new Date().toISOString();
      }
    } else {
      type = "placeholder";
      url = buildPlaceholderUrl(req, user.username);
      generatedAt = new Date().toISOString();
    }

    return NextResponse.json(
      {
        type,
        url,
        generated_at: generatedAt,
        is_live: isLive,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[routes-f/preview] GET error:", error);
    return NextResponse.json(
      { error: "Failed to resolve stream preview" },
      { status: 500 }
    );
  }
}
