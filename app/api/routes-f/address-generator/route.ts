import { NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

export type CountryCode = "US" | "UK" | "NG";

export interface SyntheticAddress {
  street: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
}

// Pools and postal formats bundled inside this folder (no external data deps).
interface CountryPool {
  country: string;
  streets: string[];
  cities: { city: string; region: string }[];
  postal: (rng: () => number) => string;
}

const digits = (rng: () => number, n: number): string =>
  Array.from({ length: n }, () => Math.floor(rng() * 10)).join("");

const letter = (rng: () => number): string =>
  String.fromCharCode(65 + Math.floor(rng() * 26));

const POOLS: Record<CountryCode, CountryPool> = {
  US: {
    country: "United States",
    streets: ["Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine Rd", "Elm St"],
    cities: [
      { city: "Springfield", region: "IL" },
      { city: "Austin", region: "TX" },
      { city: "Denver", region: "CO" },
      { city: "Portland", region: "OR" },
    ],
    postal: (rng) => digits(rng, 5),
  },
  UK: {
    country: "United Kingdom",
    streets: ["High St", "Station Rd", "Church Ln", "Victoria Rd", "Kings Way"],
    cities: [
      { city: "London", region: "England" },
      { city: "Manchester", region: "England" },
      { city: "Glasgow", region: "Scotland" },
      { city: "Cardiff", region: "Wales" },
    ],
    // e.g. "AB1 2CD"
    postal: (rng) =>
      `${letter(rng)}${letter(rng)}${digits(rng, 1)} ${digits(rng, 1)}${letter(rng)}${letter(rng)}`,
  },
  NG: {
    country: "Nigeria",
    streets: ["Awolowo Rd", "Adeola Odeku St", "Broad St", "Ahmadu Bello Way"],
    cities: [
      { city: "Lagos", region: "Lagos" },
      { city: "Abuja", region: "FCT" },
      { city: "Kano", region: "Kano" },
      { city: "Enugu", region: "Enugu" },
    ],
    postal: (rng) => digits(rng, 6),
  },
};

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

const pick = <T>(arr: T[], rng: () => number): T =>
  arr[Math.floor(rng() * arr.length)];

/** Generate `count` deterministic synthetic addresses for `country` from `seed`. */
export function generateAddresses(
  count: number,
  country: CountryCode,
  seed: number,
): SyntheticAddress[] {
  const rng = mulberry32(seed);
  const pool = POOLS[country];
  return Array.from({ length: count }, () => {
    const number = 1 + Math.floor(rng() * 9998);
    const { city, region } = pick(pool.cities, rng);
    return {
      street: `${number} ${pick(pool.streets, rng)}`,
      city,
      region,
      postal_code: pool.postal(rng),
      country: pool.country,
    };
  });
}

const schema = z.object({
  count: z.coerce.number().int().min(1).max(100).optional().default(5),
  country: z.enum(["US", "UK", "NG"]).optional().default("US"),
  seed: z.coerce.number().int().optional().default(0),
});

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const result = validateQuery(searchParams, schema);
  if (result instanceof NextResponse) {return result;}
  const { count, country, seed } = result.data;
  return NextResponse.json({ addresses: generateAddresses(count, country, seed) });
}
