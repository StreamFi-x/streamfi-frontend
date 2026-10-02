/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, terms, marker = '**', case_sensitive = false } = body;

    if (typeof text !== 'string') {
      return NextResponse.json({ error: 'text must be a string' }, { status: 400 });
    }
    if (!Array.isArray(terms) || !terms.every(t => typeof t === 'string' && t.length > 0)) {
      return NextResponse.json({ error: 'terms must be an array of non-empty strings' }, { status: 400 });
    }
    if (typeof marker !== 'string') {
      return NextResponse.json({ error: 'marker must be a string' }, { status: 400 });
    }

    const intervals: [number, number][] = [];

    const flags = case_sensitive ? 'g' : 'gi';

    for (const term of terms) {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        intervals.push([match.index, match.index + match[0].length]);
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    }

    const match_count = intervals.length;

    if (intervals.length === 0) {
      return NextResponse.json({ result: text, match_count: 0 });
    }

    intervals.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

    const merged: [number, number][] = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i];
      const previous = merged[merged.length - 1];

      if (current[0] <= previous[1]) {
        previous[1] = Math.max(previous[1], current[1]);
      } else {
        merged.push(current);
      }
    }

    let result = '';
    let lastIndex = 0;
    for (const [start, end] of merged) {
      result += text.slice(lastIndex, start);
      result += marker + text.slice(start, end) + marker;
      lastIndex = end;
    }
    result += text.slice(lastIndex);

    return NextResponse.json({ result, match_count });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
