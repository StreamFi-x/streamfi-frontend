import { NextRequest, NextResponse } from 'next/server';
import { getColorTag, setColorTag, deleteColorTag, isValidHexColor } from './colorData';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const streamId = searchParams.get('stream_id');

  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  const tag = getColorTag(streamId);
  if (!tag) {
    return NextResponse.json({ error: 'No color tag found for this stream' }, { status: 404 });
  }

  return NextResponse.json(tag);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stream_id, color_hex } = body;

    if (!stream_id || !color_hex) {
      return NextResponse.json(
        { error: 'stream_id and color_hex are required' },
        { status: 400 },
      );
    }

    if (!isValidHexColor(color_hex)) {
      return NextResponse.json(
        { error: 'Invalid hex color. Must be #RGB or #RRGGBB format' },
        { status: 400 },
      );
    }

    const tag = setColorTag(stream_id, color_hex);
    return NextResponse.json(tag, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const streamId = searchParams.get('stream_id');

  if (!streamId) {
    return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
  }

  const existed = deleteColorTag(streamId);
  if (!existed) {
    return NextResponse.json({ error: 'No color tag found for this stream' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Color tag cleared', stream_id: streamId });
}