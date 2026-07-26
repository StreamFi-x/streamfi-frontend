import { NextResponse } from 'next/server';

export interface Stream {
  id: string;
  creator_id: string;
  title: string;
  category: string;
  tags: string[];
  ended_at: number | null; // null if live
}

export function getSeedStreams(now: number): Stream[] {
  return [
    {
      id: 's1',
      creator_id: 'c1',
      title: 'Just chatting',
      category: 'IRL',
      tags: ['chatting'],
      ended_at: now - 10 * 60 * 1000, // 10 mins ago
    },
    {
      id: 's2',
      creator_id: 'c2',
      title: 'Speedrun practice',
      category: 'Gaming',
      tags: ['speedrun', 'mario'],
      ended_at: now - 60 * 60 * 1000, // 1 hour ago
    },
    {
      id: 's3',
      creator_id: 'c3',
      title: 'Live now!',
      category: 'Gaming',
      tags: [],
      ended_at: null, // live
    }
  ];
}

export function isResumable(ended_at: number, now: number): boolean {
  const diff = now - ended_at;
  return diff <= 15 * 60 * 1000;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creator_id = searchParams.get('creator_id');

  if (!creator_id) {
    return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
  }

  const now = Date.now();
  const streams = getSeedStreams(now);
  
  const creatorStreams = streams
    .filter((s) => s.creator_id === creator_id && s.ended_at !== null)
    .sort((a, b) => (b.ended_at as number) - (a.ended_at as number));

  if (creatorStreams.length === 0) {
    return NextResponse.json({ error: 'No previous streams found' }, { status: 404 });
  }

  const lastStream = creatorStreams[0];
  const resumable = isResumable(lastStream.ended_at as number, now);

  return NextResponse.json({
    last_stream: {
      title: lastStream.title,
      category: lastStream.category,
      tags: lastStream.tags,
      ended_at: lastStream.ended_at,
    },
    resumable
  });
}
