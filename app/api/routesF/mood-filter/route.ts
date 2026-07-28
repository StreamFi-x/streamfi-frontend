import { NextRequest, NextResponse } from 'next/server';

export const MOODS = ['chill', 'hype', 'chat', 'gaming', 'learning'] as const;
export type Mood = (typeof MOODS)[number];

export interface SeedMoodStream {
  stream_id: string;
  creator_id: string;
  title: string;
  mood: Mood;
  viewers: number;
}

// Seed live streams tagged with a mood, bundled per the routesF scope
// constraint. At least one stream per mood so every mood has a match.
export const SEED_MOOD_STREAMS: SeedMoodStream[] = [
  { stream_id: 'mood-1', creator_id: 'creator-1', title: 'Lofi and chill', mood: 'chill', viewers: 300 },
  { stream_id: 'mood-2', creator_id: 'creator-2', title: 'Hype ranked climb', mood: 'hype', viewers: 950 },
  { stream_id: 'mood-3', creator_id: 'creator-3', title: 'Just chatting', mood: 'chat', viewers: 420 },
  { stream_id: 'mood-4', creator_id: 'creator-4', title: 'Speedrun grind', mood: 'gaming', viewers: 610 },
  { stream_id: 'mood-5', creator_id: 'creator-5', title: 'Live coding tutorial', mood: 'learning', viewers: 180 },
  { stream_id: 'mood-6', creator_id: 'creator-6', title: 'Chill painting session', mood: 'chill', viewers: 90 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mood = searchParams.get('mood');

  if (!mood || mood.trim() === '') {
    return NextResponse.json({ error: 'mood is required' }, { status: 400 });
  }

  if (!(MOODS as readonly string[]).includes(mood)) {
    return NextResponse.json(
      { error: `Unknown mood "${mood}". Supported: ${MOODS.join(', ')}` },
      { status: 404 }
    );
  }

  const streams = SEED_MOOD_STREAMS.filter((s) => s.mood === mood);

  return NextResponse.json({ streams });
}
