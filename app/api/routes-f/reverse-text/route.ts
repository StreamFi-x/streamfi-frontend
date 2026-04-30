import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, mode } = body;

    if (typeof text !== 'string' || !mode) {
      return NextResponse.json({ error: 'Missing text or mode' }, { status: 400 });
    }

    if (text.length > 1024 * 1024) {
      return NextResponse.json({ error: 'Input too large' }, { status: 413 });
    }

    let result = '';

    if (mode === 'char') {
      result = Array.from(text).reverse().join('');
    } else if (mode === 'word') {
      // preserve whitespace structure
      const wordsAndSpaces = text.match(/(\s+|\S+)/g) || [];
      const words = wordsAndSpaces.filter(w => /\S/.test(w)).reverse();
      let wordIndex = 0;
      result = wordsAndSpaces.map(part => {
        if (/\S/.test(part)) {
          return words[wordIndex++];
        }
        return part; // keep spaces
      }).join('');
    } else if (mode === 'sentence') {
      const sentencesAndSpaces = text.match(/([^.!?]+[.!?]+|\s+)/g) || [text];
      const sentences = sentencesAndSpaces.filter(s => /\S/.test(s)).reverse();
      let sentenceIndex = 0;
      result = sentencesAndSpaces.map(part => {
        if (/\S/.test(part)) {
          return sentences[sentenceIndex++];
        }
        return part;
      }).join('');
    } else if (mode === 'line') {
      result = text.split(/\r?\n/).reverse().join('\n');
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    return NextResponse.json({ result, mode });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
