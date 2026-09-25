import { NextRequest, NextResponse } from 'next/server';

export interface SeedLiveStream {
  stream_id: string;
  creator_id: string;
  title: string;
  category: string;
  started_at: string;
  viewers: number;
}

// Seed currently-live streams with start times, bundled per the routesF
// scope constraint.
export const SEED_LIVE_STREAMS: SeedLiveStream[] = [
  { stream_id: 'live-1', creator_id: 'creator-1', title: '24h charity marathon', category: 'gaming', started_at: '2026-07-21T20:00:00Z', viewers: 1800 },
  { stream_id: 'live-2', creator_id: 'creator-2', title: 'Late night lofi', category: 'music', started_at: '2026-07-22T06:00:00Z', viewers: 420 },
  { stream_id: 'live-3', creator_id: 'creator-3', title: 'Ranked grind', category: 'gaming', started_at: '2026-07-22T10:30:00Z', viewers: 95 },
  { stream_id: 'live-4', creator_id: 'creator-4', title: 'Breakfast cookalong', category: 'cooking', started_at: '2026-07-22T09:00:00Z', viewers: 210 },
];

const DEFAULT_LIMIT = 20;
const MS_PER_HOUR = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');

  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: 'limit must be an integer between 1 and 100' },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  const now = Date.now();
  const streams = SEED_LIVE_STREAMS.map((s) => {
    const uptimeMs = Math.max(0, now - new Date(s.started_at).getTime());
    return {
      ...s,
      hours_live: Math.round((uptimeMs / MS_PER_HOUR) * 10) / 10,
    };
  })
    .sort((a, b) => b.hours_live - a.hours_live)
    .slice(0, limit);

  return NextResponse.json({ streams });
}
