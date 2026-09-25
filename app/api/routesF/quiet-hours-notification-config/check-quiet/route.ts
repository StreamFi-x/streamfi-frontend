import { NextRequest, NextResponse } from 'next/server';
import { getConfig, isInQuietHours } from '../store';

// POST /check-quiet { viewer_id, at?: ISO } -> { in_quiet_hours }
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;
  const viewerId = typeof body.viewer_id === 'string' ? body.viewer_id.trim() : '';

  if (!viewerId) {
    return NextResponse.json({ error: 'viewer_id is required' }, { status: 400 });
  }

  let at = new Date();
  if (body.at !== undefined) {
    if (typeof body.at !== 'string') {
      return NextResponse.json({ error: 'at must be an ISO 8601 timestamp string' }, { status: 400 });
    }
    const parsed = new Date(body.at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'at must be a valid ISO 8601 timestamp' }, { status: 400 });
    }
    at = parsed;
  }

  const config = getConfig(viewerId);

  return NextResponse.json({ in_quiet_hours: isInQuietHours(config, at) });
}
