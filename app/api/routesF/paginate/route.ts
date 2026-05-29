import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, offset = 0, limit = 20 } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
    }

    const clampedLimit = Math.min(Math.max(1, limit), 100);
    const clampedOffset = Math.max(0, offset);

    const total = items.length;
    const data = items.slice(clampedOffset, clampedOffset + clampedLimit);
    const has_more = clampedOffset + clampedLimit < total;
    const next_offset = has_more ? clampedOffset + clampedLimit : clampedOffset;

    return NextResponse.json({
      data,
      total,
      offset: clampedOffset,
      limit: clampedLimit,
      has_more,
      next_offset,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
