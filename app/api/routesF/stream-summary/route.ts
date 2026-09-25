import { NextResponse } from 'next/server';
import { seedStreams } from './data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stream_id = searchParams.get('stream_id');

  if (!stream_id) {
    return NextResponse.json({ error: 'Missing stream_id' }, { status: 400 });
  }

  const stream = seedStreams.find(s => s.id === stream_id);
  
  if (!stream) {
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  }

  return NextResponse.json(stream);
}
