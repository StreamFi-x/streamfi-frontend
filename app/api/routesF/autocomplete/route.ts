import { NextResponse } from 'next/server';
import { corpus } from './data';
import { autocompleteCache, getCacheKey } from '@/lib/search-cache';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 8;

  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }

  const query = q.toLowerCase();
  const cacheKey = getCacheKey(query, 'autocomplete');

  // Check server-side cache first
  const cachedResults = autocompleteCache.get(cacheKey);
  if (cachedResults) {
    return NextResponse.json(
      { suggestions: cachedResults },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
          'X-Cache': 'HIT',
        },
      }
    );
  }

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

  // Store in server-side cache
  autocompleteCache.set(cacheKey, suggestions);

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
        'X-Cache': 'MISS',
      },
    }
  );
}
