/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { resetWizard } from '../wizard-state';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.viewer_id !== 'string' || body.viewer_id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid viewer_id' }, { status: 400 });
    }

    const state = resetWizard(body.viewer_id);

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
