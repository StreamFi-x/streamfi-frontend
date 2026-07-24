import { NextRequest, NextResponse } from 'next/server';
import { VOD_QUALITIES } from './store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playbackId = searchParams.get('playback_id');

  if (!playbackId) {
    return NextResponse.json({ error: 'playback_id is required' }, { status: 400 });
  }

  const qualities = VOD_QUALITIES[playbackId];
  if (!qualities) {
    return NextResponse.json({ error: 'VOD not found' }, { status: 404 });
  }

  return NextResponse.json({ qualities });
}
