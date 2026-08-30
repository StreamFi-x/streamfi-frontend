/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { advanceWizard } from '../wizard-state';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.viewer_id !== 'string' || body.viewer_id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid viewer_id' }, { status: 400 });
    }

    if (typeof body.step !== 'string' || body.step.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid step' }, { status: 400 });
    }

    if (body.choice !== undefined && typeof body.choice !== 'string') {
      return NextResponse.json({ error: 'choice must be a string' }, { status: 400 });
    }

    const { state, error } = advanceWizard(body.viewer_id, body.step, body.choice);

    if (error) {
      return NextResponse.json({ error }, { status: 409 });
    }

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
