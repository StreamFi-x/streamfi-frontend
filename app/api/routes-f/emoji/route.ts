import { NextRequest, NextResponse } from "next/server";
import emojis from "./_lib/emojis.json";
import { searchEmojis } from "./_lib/helpers";
import type { Emoji } from "./_lib/types";

const VALID_CATEGORIES = ["smileys", "people", "nature", "food", "travel", "objects", "symbols", "flags"];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  if (limitParam && (isNaN(limit) || limit < 1)) {
    return NextResponse.json({ error: "limit must be a positive integer." }, { status: 400 });
  }

  const results = searchEmojis(emojis as Emoji[], q, category, limit);
  return NextResponse.json({ results });
}
