import { NextResponse } from 'next/server';
import { seedReferralViewers, classifySource } from './seed-data';

interface SourceBreakdown {
  source: 'direct' | 'social' | 'embed' | 'search' | 'other';
  count: number;
  percent: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');

    if (!streamId || typeof streamId !== 'string' || streamId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid stream_id parameter' },
        { status: 400 }
      );
    }

    const viewers = seedReferralViewers.filter((v) => v.stream_id === streamId);

    if (viewers.length === 0) {
      return NextResponse.json(
        { sources: [] },
        { status: 200 }
      );
    }

    const sourceCounts: Record<string, number> = {
      direct: 0,
      social: 0,
      embed: 0,
      search: 0,
      other: 0,
    };

    viewers.forEach((viewer) => {
      const source = classifySource(viewer.referrer);
      sourceCounts[source]++;
    });

    const sources: SourceBreakdown[] = Object.entries(sourceCounts)
      .filter(([_, count]) => count > 0)
      .map(([source, count]) => ({
        source: source as 'direct' | 'social' | 'embed' | 'search' | 'other',
        count,
        percent: Number(((count / viewers.length) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
