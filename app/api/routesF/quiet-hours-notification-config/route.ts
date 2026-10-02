import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig, isValidTimezone } from './store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get('viewer_id');

  if (!viewerId || viewerId.trim() === '') {
    return NextResponse.json({ error: 'viewer_id is required' }, { status: 400 });
  }

  return NextResponse.json(getConfig(viewerId));
}

function isValidHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

export async function PUT(req: NextRequest) {
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
  if (!isValidHour(body.start_hour)) {
    return NextResponse.json({ error: 'start_hour must be an integer between 0 and 23' }, { status: 400 });
  }
  if (!isValidHour(body.end_hour)) {
    return NextResponse.json({ error: 'end_hour must be an integer between 0 and 23' }, { status: 400 });
  }
  if (typeof body.timezone !== 'string' || !isValidTimezone(body.timezone)) {
    return NextResponse.json({ error: 'timezone must be a valid IANA time zone name' }, { status: 400 });
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }

  const updated = setConfig(viewerId, {
    start_hour: body.start_hour,
    end_hour: body.end_hour,
    timezone: body.timezone,
    enabled: body.enabled,
  });

  return NextResponse.json(updated);
}
