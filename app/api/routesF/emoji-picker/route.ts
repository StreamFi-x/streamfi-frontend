import { NextResponse } from 'next/server';
import { createSeededRandom } from './rng';
import { ALL_CATEGORIES, getEmojiPool, EmojiFilterCategory } from './emoji-data';

function parseInteger(value: string | null) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function isFilterCategory(value: string): value is EmojiFilterCategory {
  return (ALL_CATEGORIES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = parseInteger(searchParams.get('count'));
  const seed = parseInteger(searchParams.get('seed'));
  const category = searchParams.get('category');

  if (count === null || seed === null || !category) {
    return NextResponse.json(
      { error: 'Missing required parameters: count, category, seed' },
      { status: 400 }
    );
  }

  if (!isFilterCategory(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const pool = getEmojiPool(category);
  const random = createSeededRandom(seed);

  const emojis = Array.from({ length: count }, () => {
    const index = Math.floor(random() * pool.length);
    return pool[index];
  });

  return NextResponse.json({ emojis });
}
