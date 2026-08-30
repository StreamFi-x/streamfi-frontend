/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";

// In-memory store for shares
// Format: clip_id -> destination -> count
export const CLIP_SHARES: Record<string, Record<string, number>> = {};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clip_id, destination } = body;

    if (!clip_id || !destination) {
      return NextResponse.json({ error: "clip_id and destination are required" }, { status: 400 });
    }

    const validDestinations = ["twitter", "telegram", "copy_link", "other"];
    if (!validDestinations.includes(destination)) {
      return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
    }

    if (!CLIP_SHARES[clip_id]) {
      CLIP_SHARES[clip_id] = {
        twitter: 0,
        telegram: 0,
        copy_link: 0,
        other: 0,
      };
    }

    CLIP_SHARES[clip_id][destination] += 1;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  const shares = CLIP_SHARES[clipId] || {
    twitter: 0,
    telegram: 0,
    copy_link: 0,
    other: 0,
  };

  const total = Object.values(shares).reduce((sum, count) => sum + count, 0);

  return NextResponse.json({
    total,
    by_destination: shares,
  });
}
