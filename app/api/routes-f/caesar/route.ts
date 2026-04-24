import { NextRequest, NextResponse } from 'next/server';
import { CaesarRequest } from './_lib/types';
import { caesarCipher, buildResponse, normalizeShift } from './_lib/helpers';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: CaesarRequest = await request.json();

    // validate text
    if (typeof body.text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "text" field' },
        { status: 400 }
      );
    }

    // validate shift
    if (typeof body.shift !== 'number' || !Number.isFinite(body.shift)) {
      return NextResponse.json(
        { error: 'Missing or invalid "shift" field — must be a number' },
        { status: 400 }
      );
    }

    // validate mode
    if (body.mode !== 'encode' && body.mode !== 'decode') {
      return NextResponse.json(
        { error: 'Invalid "mode" — must be "encode" or "decode"' },
        { status: 400 }
      );
    }

    const normalizedShift = normalizeShift(body.shift);
    const result = caesarCipher(body.text, body.shift, body.mode);
    const response = buildResponse(result, body.shift, body.text, body.mode);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[caesar] Cipher operation failed');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}