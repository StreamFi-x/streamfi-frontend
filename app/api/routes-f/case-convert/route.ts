import { NextRequest, NextResponse } from 'next/server';
import { convertCase } from './data';
import { CaseConvertRequest, CaseConvertResponse } from './types';

export async function POST(request: NextRequest) {
  try {
    const body: CaseConvertRequest = await request.json();
    
    // Validate request body
    if (!body || typeof body.text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { text: string, target?: string }' },
        { status: 400 }
      );
    }

    // Validate target if provided
    const validTargets = ['camelCase', 'snake_case', 'kebab-case', 'PascalCase', 'CONSTANT_CASE', 'Title Case', 'Sentence case'];
    if (body.target && !validTargets.includes(body.target)) {
      return NextResponse.json(
        { 
          error: 'Invalid target case. Must be one of: ' + validTargets.join(', ') 
        },
        { status: 400 }
      );
    }

    const result = convertCase(body.text, body.target);
    
    return NextResponse.json(result as CaseConvertResponse);
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
