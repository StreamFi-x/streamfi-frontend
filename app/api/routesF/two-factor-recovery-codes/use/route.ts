/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { useCode as consumeRecoveryCode } from '../store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, code } = body;

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const result = consumeRecoveryCode(user_id, code);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
