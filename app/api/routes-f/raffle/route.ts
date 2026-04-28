import { NextRequest, NextResponse } from "next/server";

const MAX_ENTRIES = 10_000;

type RawEntry = string | { name?: unknown; weight?: unknown };

type NormalizedEntry = {
  name: string;
  weight: number;
};

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWeightedIndex(entries: NormalizedEntry[], random: () => number): number {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = random() * total;

  for (let i = 0; i < entries.length; i++) {
    threshold -= entries[i].weight;
    if (threshold <= 0) {
      return i;
    }
  }

  return entries.length - 1;
}

function normalizeEntries(rawEntries: RawEntry[]):
  | { ok: true; entries: NormalizedEntry[] }
  | { ok: false; error: string } {
  const normalized: NormalizedEntry[] = [];

  for (const raw of rawEntries) {
    if (typeof raw === "string") {
      if (raw.trim().length === 0) {
        return { ok: false, error: "entry names must be non-empty strings." };
      }
      normalized.push({ name: raw, weight: 1 });
      continue;
    }

    if (!raw || typeof raw !== "object" || typeof raw.name !== "string" || raw.name.trim().length === 0) {
      return { ok: false, error: "object entries must include a non-empty name." };
    }

    const weight = raw.weight === undefined ? 1 : Number(raw.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return { ok: false, error: "weight must be a positive number." };
    }

    normalized.push({ name: raw.name, weight });
  }

  return { ok: true, entries: normalized };
}

export async function POST(req: NextRequest) {
  let body: {
    entries?: unknown;
    winners?: unknown;
    seed?: unknown;
    allow_repeat?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: "entries must be an array." }, { status: 400 });
  }

  if (body.entries.length === 0) {
    return NextResponse.json({ error: "entries must not be empty." }, { status: 400 });
  }

  if (body.entries.length > MAX_ENTRIES) {
    return NextResponse.json(
      { error: `entries exceeds maximum size of ${MAX_ENTRIES}.` },
      { status: 400 }
    );
  }

  const normalizedResult = normalizeEntries(body.entries as RawEntry[]);
  if (!normalizedResult.ok) {
    return NextResponse.json({ error: normalizedResult.error }, { status: 400 });
  }

  const requestedWinners = body.winners === undefined ? 1 : Number(body.winners);
  if (!Number.isInteger(requestedWinners) || requestedWinners < 1) {
    return NextResponse.json({ error: "winners must be an integer >= 1." }, { status: 400 });
  }

  const allowRepeat = body.allow_repeat === undefined ? false : Boolean(body.allow_repeat);

  const seedUsed =
    body.seed === undefined
      ? String(Date.now())
      : typeof body.seed === "number" || typeof body.seed === "string"
        ? String(body.seed)
        : "";

  if (seedUsed.length === 0) {
    return NextResponse.json({ error: "seed must be a string or number when provided." }, { status: 400 });
  }

  const random = createSeededRandom(seedUsed);
  const entries = normalizedResult.entries;

  if (!allowRepeat && requestedWinners > entries.length) {
    return NextResponse.json(
      { error: "winners cannot exceed number of entries when allow_repeat=false." },
      { status: 400 }
    );
  }

  if (allowRepeat) {
    const winners: string[] = [];
    for (let i = 0; i < requestedWinners; i++) {
      const index = drawWeightedIndex(entries, random);
      winners.push(entries[index].name);
    }

    const winnerSet = new Set(winners);
    const runnersUp = entries
      .map((entry) => entry.name)
      .filter((name) => !winnerSet.has(name));

    return NextResponse.json({ winners, runners_up: runnersUp, seed_used: seedUsed });
  }

  const pool = [...entries];
  const ranking: string[] = [];

  while (pool.length > 0) {
    const index = drawWeightedIndex(pool, random);
    const [picked] = pool.splice(index, 1);
    ranking.push(picked.name);
  }

  return NextResponse.json({
    winners: ranking.slice(0, requestedWinners),
    runners_up: ranking.slice(requestedWinners),
    seed_used: seedUsed,
  });
}
