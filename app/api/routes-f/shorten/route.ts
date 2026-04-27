import { NextRequest, NextResponse } from 'next/server';
import { generateCode } from './_lib/code-generator';
import { validateUrl } from './_lib/validation';
import { UrlStorage } from './_lib/storage';
import type { ShortenRequest, ShortenResponse, ValidationError } from './_lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<ShortenResponse | ValidationError>> {
  try {
    // Parse request body
    const body: ShortenRequest = await request.json();
    
    // Validate the URL
    const validationError = validateUrl(body.url);
    if (validationError) {
      return NextResponse.json(validationError, { status: 400 });
    }
    
    // Generate a unique code
    const code = generateCode();
    
    // Store the URL
    UrlStorage.set(code, body.url.trim());
    
    // Construct the short URL
    const baseUrl = new URL(request.url).origin;
    const shortUrl = `${baseUrl}/api/routes-f/shorten/${code}`;
    
    // Return response
    const response: ShortenResponse = {
      code,
      short_url: shortUrl
    };
    
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Handle code generation errors or other server errors
    if (error instanceof Error && error.message === 'Unable to generate unique code after maximum attempts') {
      return NextResponse.json(
        { message: 'Unable to generate unique code. Please try again.', code: 'INVALID_URL' as const },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal server error', code: 'INVALID_URL' as const },
      { status: 500 }
    );
  }
}
