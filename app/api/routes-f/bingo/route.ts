import { NextRequest, NextResponse } from "next/server";

const DEFAULT_COUNT = 1;
const MAX_COUNT = 20;
const FREE_CENTER_VALUE = 0;

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle(values: number[], rng: () => number) {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildColumn(
  min: number,
  max: number,
  picks: number,
  rng: () => number
) {
  return shuffle(
    Array.from({ length: max - min + 1 }, (_, i) => min + i),
    rng
  ).slice(0, picks);
}

function buildCard(rng: () => number) {
  const b = buildColumn(1, 15, 5, rng);
  const i = buildColumn(16, 30, 5, rng);
  const n = buildColumn(31, 45, 4, rng);
  const g = buildColumn(46, 60, 5, rng);
  const o = buildColumn(61, 75, 5, rng);

  const card = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (let row = 0; row < 5; row++) {
    card[row][0] = b[row];
    card[row][1] = i[row];
    card[row][2] = row === 2 ? FREE_CENTER_VALUE : n[row > 2 ? row - 1 : row];
    card[row][3] = g[row];
    card[row][4] = o[row];
  }
  return card;
}

export function GET(request: NextRequest) {
  const seedParam = request.nextUrl.searchParams.get("seed");
  const countParam = request.nextUrl.searchParams.get("count");

  const seed = seedParam === null ? Date.now() : Number(seedParam);
  if (!Number.isFinite(seed)) {
    return NextResponse.json(
      { error: "seed must be numeric" },
      { status: 400 }
    );
  }

  const count = countParam === null ? DEFAULT_COUNT : Number(countParam);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return NextResponse.json(
      { error: `count must be an integer between 1 and ${MAX_COUNT}` },
      { status: 400 }
    );
  }

  const rng = createRng(seed);
  const cards = Array.from({ length: count }, () => buildCard(rng));
  return NextResponse.json({ cards });
}
