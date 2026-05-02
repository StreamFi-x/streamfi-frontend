import { NextRequest, NextResponse } from "next/server";
import { getFiltered, pickRandom, formatJoke } from "./_lib/helpers";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? undefined;
  const seenParam = searchParams.get("seen");
  const seen = seenParam
    ? seenParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n))
    : [];

  const validCategories = ["programming", "dad", "pun", "general"];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
      { status: 400 }
    );
  }

  const pool = getFiltered(category, seen);
  const joke = pickRandom(pool);

  if (!joke) {
    return NextResponse.json(
      { error: "No jokes available for the given filters." },
      { status: 404 }
    );
  }

  return NextResponse.json({ joke: formatJoke(joke) });
}
