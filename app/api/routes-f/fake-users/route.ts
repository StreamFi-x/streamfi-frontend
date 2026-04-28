import { NextRequest, NextResponse } from "next/server";
import { generateFakeUsers } from "./_lib/generator";

const DEFAULT_COUNT = 5;
const MAX_COUNT = 100;
const DEFAULT_SEED = 42;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countRaw = searchParams.get("count");
  const seedRaw = searchParams.get("seed");

  const count = countRaw === null ? DEFAULT_COUNT : Number.parseInt(countRaw, 10);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return NextResponse.json(
      { error: `count must be an integer between 1 and ${MAX_COUNT}` },
      { status: 400 },
    );
  }

  const seed = seedRaw === null ? DEFAULT_SEED : Number(seedRaw);
  if (!Number.isFinite(seed)) {
    return NextResponse.json({ error: "seed must be a finite number" }, { status: 400 });
  }

  return NextResponse.json({
    users: generateFakeUsers(count, seed),
  });
}
