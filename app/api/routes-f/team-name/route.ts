import { NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

export type TeamStyle = "fierce" | "funny" | "classic";

// Pools bundled in-folder (no external data deps).
const ADJECTIVES: Record<TeamStyle, string[]> = {
  fierce: ["Savage", "Iron", "Brutal", "Raging", "Venomous", "Storm", "Shadow", "Apex"],
  funny: ["Wobbly", "Sneaky", "Spicy", "Clumsy", "Hangry", "Derpy", "Sleepy", "Cheeky"],
  classic: ["Royal", "Golden", "United", "Athletic", "Imperial", "Grand", "Premier", "Legacy"],
};

const MASCOTS = [
  "Tigers", "Wolves", "Falcons", "Dragons", "Vipers", "Titans",
  "Sharks", "Ravens", "Bulls", "Phoenix", "Cobras", "Hawks",
];

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

/** Generate `count` deterministic team names in the given style from `seed`. */
export function generateTeamNames(count: number, seed: number, style: TeamStyle): string[] {
  const rng = mulberry32(seed);
  const adjectives = ADJECTIVES[style];
  return Array.from({ length: count }, () => `${pick(adjectives, rng)} ${pick(MASCOTS, rng)}`);
}

const schema = z.object({
  count: z.coerce.number().int().min(1).max(50).optional().default(5),
  seed: z.coerce.number().int().optional().default(0),
  style: z.enum(["fierce", "funny", "classic"]).optional().default("classic"),
});

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const result = validateQuery(searchParams, schema);
  if (result instanceof NextResponse) {return result;}
  const { count, seed, style } = result.data;
  return NextResponse.json({ names: generateTeamNames(count, seed, style) });
}
