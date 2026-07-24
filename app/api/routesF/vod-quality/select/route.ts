import { NextRequest, NextResponse } from 'next/server';
import { VOD_QUALITIES, QUALITY_SELECTIONS } from '../store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { viewer_id, playback_id, label } = body;

    if (!viewer_id || typeof viewer_id !== 'string') {
      return NextResponse.json({ error: 'viewer_id is required' }, { status: 400 });
    }
    if (!playback_id || typeof playback_id !== 'string') {
      return NextResponse.json({ error: 'playback_id is required' }, { status: 400 });
    }
    if (!label || typeof label !== 'string') {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const qualities = VOD_QUALITIES[playback_id];
    if (!qualities) {
      return NextResponse.json({ error: 'VOD not found' }, { status: 404 });
    }
    if (!qualities.some((q) => q.label === label)) {
      return NextResponse.json(
        { error: `label must be one of: ${qualities.map((q) => q.label).join(', ')}` },
        { status: 400 }
      );
    }

    if (!QUALITY_SELECTIONS[viewer_id]) {
      QUALITY_SELECTIONS[viewer_id] = {};
    }
    QUALITY_SELECTIONS[viewer_id][playback_id] = label;

    return NextResponse.json({ viewer_id, playback_id, label });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
