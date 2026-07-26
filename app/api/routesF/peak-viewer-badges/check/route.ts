import { NextRequest, NextResponse } from 'next/server';
import { BADGE_LADDER, AWARDED_BADGES } from '../store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creator_id, peak_viewers } = body;

    if (!creator_id || typeof creator_id !== 'string') {
      return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
    }
    if (typeof peak_viewers !== 'number' || !Number.isInteger(peak_viewers) || peak_viewers < 0) {
      return NextResponse.json(
        { error: 'peak_viewers must be a non-negative integer' },
        { status: 400 }
      );
    }

    if (!AWARDED_BADGES[creator_id]) {
      AWARDED_BADGES[creator_id] = new Set();
    }
    const awarded = AWARDED_BADGES[creator_id];

    // Idempotent: every qualifying badge not yet held is awarded exactly once;
    // re-checking the same peak returns an empty list.
    const newlyAwarded: string[] = [];
    for (const { threshold, badge } of BADGE_LADDER) {
      if (peak_viewers >= threshold && !awarded.has(badge)) {
        awarded.add(badge);
        newlyAwarded.push(badge);
      }
    }

    return NextResponse.json({ newly_awarded: newlyAwarded });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
