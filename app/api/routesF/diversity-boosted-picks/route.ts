import { NextRequest, NextResponse } from 'next/server';

export interface SeedCreator {
  creator_id: string;
  name: string;
  category: string;
  language: string;
}

// Seed creator pool with category/language, bundled per the routesF scope
// constraint. Four categories x three creators each, so the default
// count=12 exercises both the round-robin cap and the backfill path below.
export const SEED_CREATORS: SeedCreator[] = [
  { creator_id: 'c-gaming-1', name: 'Gaming One', category: 'gaming', language: 'en' },
  { creator_id: 'c-gaming-2', name: 'Gaming Two', category: 'gaming', language: 'es' },
  { creator_id: 'c-gaming-3', name: 'Gaming Three', category: 'gaming', language: 'en' },
  { creator_id: 'c-music-1', name: 'Music One', category: 'music', language: 'en' },
  { creator_id: 'c-music-2', name: 'Music Two', category: 'music', language: 'fr' },
  { creator_id: 'c-music-3', name: 'Music Three', category: 'music', language: 'en' },
  { creator_id: 'c-cooking-1', name: 'Cooking One', category: 'cooking', language: 'es' },
  { creator_id: 'c-cooking-2', name: 'Cooking Two', category: 'cooking', language: 'en' },
  { creator_id: 'c-cooking-3', name: 'Cooking Three', category: 'cooking', language: 'en' },
  { creator_id: 'c-art-1', name: 'Art One', category: 'art', language: 'en' },
  { creator_id: 'c-art-2', name: 'Art Two', category: 'art', language: 'fr' },
  { creator_id: 'c-art-3', name: 'Art Three', category: 'art', language: 'en' },
];

const MAX_PER_CATEGORY = 2;
const DEFAULT_COUNT = 12;
const MAX_COUNT = 50;

/**
 * Selects up to `count` creators from `pool`, preferring diversity: at most
 * MAX_PER_CATEGORY are taken per category in a first pass (round-robin
 * across categories, in the order each category first appears in `pool`),
 * and only if `count` still isn't met does a second pass backfill
 * additional creators from categories that have more to offer. This means
 * the "at most 2 per category" rule is a genuine preference, not a hard
 * cap that would silently return fewer than `count` results when more are
 * available.
 */
export function selectDiverse(pool: SeedCreator[], count: number): SeedCreator[] {
  const byCategory = new Map<string, SeedCreator[]>();
  const categoryOrder: string[] = [];
  for (const creator of pool) {
    if (!byCategory.has(creator.category)) {
      byCategory.set(creator.category, []);
      categoryOrder.push(creator.category);
    }
    byCategory.get(creator.category)!.push(creator);
  }

  const selected: SeedCreator[] = [];

  for (let round = 0; round < MAX_PER_CATEGORY && selected.length < count; round++) {
    for (const category of categoryOrder) {
      if (selected.length >= count) {break;}
      const candidate = byCategory.get(category)![round];
      if (candidate) {selected.push(candidate);}
    }
  }

  if (selected.length < count) {
    for (const category of categoryOrder) {
      const categoryPool = byCategory.get(category)!;
      for (let i = MAX_PER_CATEGORY; i < categoryPool.length; i++) {
        if (selected.length >= count) {break;}
        selected.push(categoryPool[i]);
      }
      if (selected.length >= count) {break;}
    }
  }

  return selected;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get('viewer_id');

  if (!viewerId || viewerId.trim() === '') {
    return NextResponse.json({ error: 'viewer_id is required' }, { status: 400 });
  }

  const countParam = searchParams.get('count');
  let count = DEFAULT_COUNT;
  if (countParam !== null) {
    const parsed = Number(countParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_COUNT) {
      return NextResponse.json(
        { error: `count must be an integer between 1 and ${MAX_COUNT}` },
        { status: 400 }
      );
    }
    count = parsed;
  }

  const creators = selectDiverse(SEED_CREATORS, count);

  return NextResponse.json({ creators });
}
