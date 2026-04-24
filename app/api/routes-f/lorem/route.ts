import { NextRequest, NextResponse } from 'next/server';
import { generateLorem } from './_lib/generator';
import { LoremType, ApiResponse } from './_lib/types';

const LIMITS = {
  words: 1000,
  sentences: 500,
  paragraphs: 100,
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const type = (searchParams.get('type') || 'paragraphs') as LoremType;
  const countStr = searchParams.get('count');
  const startLorem = searchParams.get('startLorem') === 'true';

  let count = countStr ? parseInt(countStr, 10) : 3;

  if (isNaN(count) || count <= 0) {
    count = 3; // Fallback to default
  }

  // Validate type
  if (!['words', 'sentences', 'paragraphs'].includes(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be 'words', 'sentences', or 'paragraphs'." } as ApiResponse,
      { status: 400 }
    );
  }

  // Enforce limits
  const limit = LIMITS[type];
  if (count > limit) {
    return NextResponse.json(
      { error: `Count too high for type '${type}'. Maximum is ${limit}.` } as ApiResponse,
      { status: 400 }
    );
  }

  try {
    const text = generateLorem(type, count, startLorem);
    return NextResponse.json({ text } as ApiResponse);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error during generation" } as ApiResponse,
      { status: 500 }
    );
  }
}
