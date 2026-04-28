import { NextRequest, NextResponse } from 'next/server';
import { escapeHtml, unescapeHtml } from './data';
import { HtmlEscapeRequest, HtmlEscapeResponse } from './types';

const MAX_INPUT_SIZE = 1024 * 1024; // 1MB

export async function POST(request: NextRequest) {
  try {
    const body: HtmlEscapeRequest = await request.json();
    
    // Validate request body
    if (!body || typeof body.input !== 'string' || !body.mode) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { input: string, mode: "escape" | "unescape" }' },
        { status: 400 }
      );
    }

    // Validate mode
    if (body.mode !== 'escape' && body.mode !== 'unescape') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "escape" or "unescape"' },
        { status: 400 }
      );
    }

    // Check input size
    if (Buffer.byteLength(body.input, 'utf8') > MAX_INPUT_SIZE) {
      return NextResponse.json(
        { error: 'Input too large. Maximum size is 1MB' },
        { status: 413 }
      );
    }

    let output: string;
    
    if (body.mode === 'escape') {
      output = escapeHtml(body.input);
    } else {
      output = unescapeHtml(body.input);
    }

    const response: HtmlEscapeResponse = { output };
    
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
