import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, allow_unicode } = body;

    if (typeof slug !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid slug' }, { status: 400 });
    }

    if (slug.length === 0) {
      return NextResponse.json({ valid: false, reason: 'Slug cannot be empty', suggestion: '' });
    }

    // Determine invalid characters based on unicode flag
    const invalidCharRegex = allow_unicode ? /[^\\p{L}\\p{N}-]/gu : /[^a-z0-9-]/g;

    let suggestion = slug;
    let reasons: string[] = [];

    // Check uppercase
    if (slug !== slug.toLowerCase()) {
      reasons.push('Contains uppercase letters');
      suggestion = suggestion.toLowerCase();
    }

    // Check invalid characters
    if (invalidCharRegex.test(suggestion)) {
      reasons.push('Contains invalid characters');
      suggestion = suggestion.replace(invalidCharRegex, '-');
    }

    // Check double hyphens
    if (/--+/.test(suggestion)) {
      reasons.push('Contains double hyphens');
      suggestion = suggestion.replace(/--+/g, '-');
    }

    // Check leading/trailing hyphens
    if (suggestion.startsWith('-') || suggestion.endsWith('-')) {
      reasons.push('Contains leading or trailing hyphens');
      suggestion = suggestion.replace(/^-+|-+$/g, '');
    }

    if (reasons.length === 0) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json({ valid: false, reason: reasons.join(', '), suggestion });
    }

  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
