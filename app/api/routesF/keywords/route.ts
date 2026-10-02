/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';

export const stopWords = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'you', 'are', 'not', 'but',
  'what', 'how', 'when', 'where', 'why', 'who', 'will', 'can', 'has', 'have'
]);

export function extractKeywords(title: string): string[] {
  // Lowercase
  const lower = title.toLowerCase();
  
  // Tokenize
  const tokens = lower.split(/[^a-z0-9]+/);
  
  const keywords = new Set<string>();
  
  for (const token of tokens) {
    if (token.length >= 3 && !stopWords.has(token)) {
      keywords.add(token);
    }
  }
  
  return Array.from(keywords);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title } = body;

    if (typeof title !== 'string') {
      return NextResponse.json({ error: 'title must be a string' }, { status: 400 });
    }

    const keywords = extractKeywords(title);

    return NextResponse.json({ keywords });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
