/**
 * GET  /api/routes-f/channel-points-earn-rate-config?creator_id=<id>
 * PUT  /api/routes-f/channel-points-earn-rate-config
 * Reads and sets how many channel points a viewer earns per minute watched
 * and per chat message, for a given creator.
 */
import { NextRequest, NextResponse } from "next/server";
import type { EarnRateConfigUpdateBody } from "./types";
import { getConfig, setConfig } from "./store";

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");

  if (!creatorId) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  return NextResponse.json(getConfig(creatorId));
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: EarnRateConfigUpdateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { creator_id, points_per_minute_watched, points_per_chat_message } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  if (points_per_minute_watched === undefined && points_per_chat_message === undefined) {
    return NextResponse.json(
      {
        error:
          "at least one of points_per_minute_watched or points_per_chat_message is required",
      },
      { status: 400 }
    );
  }

  if (points_per_minute_watched !== undefined && !isValidRate(points_per_minute_watched)) {
    return NextResponse.json(
      { error: "points_per_minute_watched must be a non-negative number" },
      { status: 400 }
    );
  }

  if (points_per_chat_message !== undefined && !isValidRate(points_per_chat_message)) {
    return NextResponse.json(
      { error: "points_per_chat_message must be a non-negative number" },
      { status: 400 }
    );
  }

  const updated = setConfig(creator_id, {
    points_per_minute_watched,
    points_per_chat_message,
  });

  return NextResponse.json(updated);
}
