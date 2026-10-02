import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  hands: z.number().int().min(1).max(54).optional().default(1),
  cards_per_hand: z.number().int().min(1).max(54).optional().default(5),
  seed: z.union([z.string(), z.number()]).optional(),
  jokers: z.boolean().optional().default(false),
});

const SUITS = ["C", "D", "H", "S"] as const;
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

function buildDeck(includeJokers: boolean): string[] {
  const deck = SUITS.flatMap(suit => RANKS.map(rank => `${rank}${suit}`));
  return includeJokers ? [...deck, "BLACK_JOKER", "RED_JOKER"] : deck;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string | number | undefined): () => number {
  if (seed === undefined) {
    return Math.random;
  }

  let state = hashSeed(String(seed));

  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDeck(deck: string[], random: () => number): string[] {
  const copy = [...deck];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map(issue => ({
          field: issue.path.join(".") || "body",
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const { hands, cards_per_hand, seed, jokers } = parsed.data;
  const deck = buildDeck(jokers);

  if (hands * cards_per_hand > deck.length) {
    return NextResponse.json(
      { error: "hands * cards_per_hand cannot exceed deck size" },
      { status: 400 }
    );
  }

  const shuffled = shuffleDeck(deck, createSeededRandom(seed));
  const dealtHands: string[][] = [];
  let cursor = 0;

  for (let handIndex = 0; handIndex < hands; handIndex += 1) {
    dealtHands.push(shuffled.slice(cursor, cursor + cards_per_hand));
    cursor += cards_per_hand;
  }

  return NextResponse.json({
    hands: dealtHands,
    remaining: shuffled.slice(cursor),
  });
}
