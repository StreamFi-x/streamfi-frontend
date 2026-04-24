import { NextRequest, NextResponse } from 'next/server';
import { convertNumberToWords } from './_lib/converter';
import { NumberStyle, ApiResponse } from './_lib/types';

const MAX_LIMIT = 1_000_000_000_000_000; // 1 quadrillion
const MIN_LIMIT = -1_000_000_000_000_000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const nStr = searchParams.get('n');
  const style = (searchParams.get('style') || 'short') as NumberStyle;

  if (nStr === null) {
    return NextResponse.json(
      { error: "Query parameter 'n' is required" } as ApiResponse,
      { status: 400 }
    );
  }

  const n = parseInt(nStr, 10);

  if (isNaN(n)) {
    return NextResponse.json(
      { error: "Query parameter 'n' must be a valid integer" } as ApiResponse,
      { status: 400 }
    );
  }

  if (n > MAX_LIMIT || n < MIN_LIMIT) {
    return NextResponse.json(
      { error: `Number out of range. Supported range: ${MIN_LIMIT} to ${MAX_LIMIT}` } as ApiResponse,
      { status: 400 }
    );
  }

  try {
    const words = convertNumberToWords(n, style);
    return NextResponse.json({ words } as ApiResponse);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error during conversion" } as ApiResponse,
      { status: 500 }
    );
  }
}
