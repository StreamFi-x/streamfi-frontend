import { NextResponse } from 'next/server';
import { recordSearch, getRecentSearches, clearHistory } from './store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const viewer_id = searchParams.get('viewer_id');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!viewer_id) {
    return NextResponse.json({ error: 'Missing viewer_id' }, { status: 400 });
  }

  const searches = getRecentSearches(viewer_id, limit);
  return NextResponse.json({ searches });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { viewer_id, query } = body;

    if (!viewer_id || !query) {
      return NextResponse.json({ error: 'Missing viewer_id or query' }, { status: 400 });
    }

    recordSearch(viewer_id, query);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const viewer_id = searchParams.get('viewer_id');

  if (!viewer_id) {
    return NextResponse.json({ error: 'Missing viewer_id' }, { status: 400 });
  }

  clearHistory(viewer_id);
  return NextResponse.json({ success: true });
}
