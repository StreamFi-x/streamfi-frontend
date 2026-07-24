import { NextRequest, NextResponse } from 'next/server';

export interface SeedCreator {
  creator_id: string;
  display_name: string;
  category: string;
  joined_at: string;
  stream_count: number;
}

// Seed creators with join dates, categories, and stream counts, bundled per
// the routesF scope constraint. Ages are relative to "now" in tests via
// Date.now() mocking; joined_at values span from days to months old.
export const SEED_CREATORS: SeedCreator[] = [
  { creator_id: 'creator-1', display_name: 'PixelMage', category: 'gaming', joined_at: '2026-07-21T10:00:00Z', stream_count: 3 },
  { creator_id: 'creator-2', display_name: 'LoFiLena', category: 'music', joined_at: '2026-07-20T18:30:00Z', stream_count: 5 },
  { creator_id: 'creator-3', display_name: 'RaidRunner', category: 'gaming', joined_at: '2026-07-19T09:15:00Z', stream_count: 0 },
  { creator_id: 'creator-4', display_name: 'ChefCosmos', category: 'cooking', joined_at: '2026-07-18T14:00:00Z', stream_count: 2 },
  { creator_id: 'creator-5', display_name: 'SpeedSis', category: 'gaming', joined_at: '2026-07-10T08:00:00Z', stream_count: 12 },
  { creator_id: 'creator-6', display_name: 'OldTimerOsa', category: 'gaming', joined_at: '2026-04-01T12:00:00Z', stream_count: 90 },
];

const DEFAULT_DAYS = 7;
const DEFAULT_MIN_STREAMS = 1;

function parsePositiveInt(value: string): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) return null;
  return num;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const daysParam = searchParams.get('days');
  const minStreamsParam = searchParams.get('min_streams');

  if (!category) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 });
  }

  let days = DEFAULT_DAYS;
  if (daysParam !== null) {
    const parsed = parsePositiveInt(daysParam);
    if (parsed === null) {
      return NextResponse.json({ error: 'days must be a positive integer' }, { status: 400 });
    }
    days = parsed;
  }

  let minStreams = DEFAULT_MIN_STREAMS;
  if (minStreamsParam !== null) {
    const parsed = Number(minStreamsParam);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: 'min_streams must be a non-negative integer' },
        { status: 400 }
      );
    }
    minStreams = parsed;
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const normalized = category.trim().toLowerCase();

  const creators = SEED_CREATORS.filter(
    (c) =>
      c.category === normalized &&
      new Date(c.joined_at).getTime() >= cutoff &&
      c.stream_count >= minStreams
  ).sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());

  return NextResponse.json({ creators, total: creators.length });
}
