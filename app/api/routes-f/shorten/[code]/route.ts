import { NextRequest, NextResponse } from 'next/server';
import { isValidCode } from '../_lib/code-generator';
import { UrlStorage } from '../_lib/storage';
import type { LookupResponse } from '../_lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
): Promise<NextResponse<LookupResponse | { message: string }>> {
  try {
    const { code } = params;
    
    // Validate code format
    if (!isValidCode(code)) {
      return NextResponse.json(
        { message: 'Invalid code format' },
        { status: 400 }
      );
    }
    
    // Look up the URL entry
    const entry = UrlStorage.get(code);
    
    if (!entry) {
      return NextResponse.json(
        { message: 'Code not found' },
        { status: 404 }
      );
    }
    
    // Increment hit counter
    UrlStorage.incrementHits(code);
    
    // Return response with updated hit count
    const response: LookupResponse = {
      url: entry.url,
      hits: entry.hits + 1 // Return incremented count
    };
    
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
