import { NextRequest, NextResponse } from 'next/server';
import { generateCodes } from '../store';

const DEFAULT_COUNT = 10;
const MAX_COUNT = 20;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, count } = body;

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    let codeCount = DEFAULT_COUNT;
    if (count !== undefined) {
      if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
        return NextResponse.json(
          { error: `count must be an integer between 1 and ${MAX_COUNT}` },
          { status: 400 }
        );
      }
      codeCount = count;
    }

    const codes = generateCodes(user_id, codeCount);

    return NextResponse.json({ codes }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
