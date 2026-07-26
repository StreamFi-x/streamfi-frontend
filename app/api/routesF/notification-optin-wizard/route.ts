import { NextResponse } from 'next/server';
import { getWizardState } from './wizard-state';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerId = searchParams.get('viewer_id');

    if (!viewerId || viewerId.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid viewer_id parameter' }, { status: 400 });
    }

    const state = getWizardState(viewerId);

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
