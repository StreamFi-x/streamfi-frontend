import { NextResponse } from 'next/server';
import { corpus } from './data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 8;

  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }

  const query = q.toLowerCase();

  const prefixMatches = [];
  const substringMatches = [];

  for (const item of corpus) {
    const labelLower = item.label.toLowerCase();
    if (labelLower.startsWith(query)) {
      prefixMatches.push(item);
    } else if (labelLower.includes(query)) {
      substringMatches.push(item);
    }
  }

  prefixMatches.sort((a, b) => b.score - a.score);
  substringMatches.sort((a, b) => b.score - a.score);

  const suggestions = [...prefixMatches, ...substringMatches].slice(0, limit);

  return NextResponse.json({ suggestions });
}
