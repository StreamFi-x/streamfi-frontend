import { NextResponse } from "next/server";
import { createSeededRandom } from "./rng";
import { getJokePool, isFilterCategory } from "./jokes-data";

function parseSeed(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const seed = parseSeed(searchParams.get("seed"));

  if (!category || seed === null) {
    return NextResponse.json(
      { error: "Missing required parameters: category, seed" },
      { status: 400 }
    );
  }

  if (!isFilterCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const pool = getJokePool(category);
  const random = createSeededRandom(seed);
  const index = Math.floor(random() * pool.length);
  const selected = pool[index];

  return NextResponse.json({
    joke: selected.joke,
    category: selected.category,
  });
}
