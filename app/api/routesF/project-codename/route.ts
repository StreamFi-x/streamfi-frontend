import { NextResponse } from 'next/server';

const adjectives = [
  'swift', 'silent', 'brave', 'clever', 'mighty', 
  'hidden', 'flying', 'crimson', 'shadow', 'golden', 
  'cyber', 'neon', 'cosmic', 'stellar', 'quantum'
];

const themes = {
  animals: ['fox', 'wolf', 'bear', 'eagle', 'tiger', 'hawk', 'lion', 'panther', 'falcon', 'owl'],
  space: ['star', 'moon', 'comet', 'planet', 'nebula', 'galaxy', 'asteroid', 'pulsar', 'quasar', 'orbit'],
  colors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white', 'silver', 'cyan']
};

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countStr = searchParams.get('count');
  const seedStr = searchParams.get('seed');
  const theme = searchParams.get('theme');

  if (!countStr || !seedStr || !theme) {
    return NextResponse.json({ error: 'Missing required parameters: count, seed, theme' }, { status: 400 });
  }

  const count = parseInt(countStr, 10);
  const seed = parseInt(seedStr, 10);

  if (isNaN(count) || isNaN(seed)) {
    return NextResponse.json({ error: 'Invalid count or seed' }, { status: 400 });
  }

  let nouns: string[] = [];
  if (theme === 'any') {
    nouns = [...themes.animals, ...themes.space, ...themes.colors];
  } else if (theme in themes) {
    nouns = themes[theme as keyof typeof themes];
  } else {
    return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
  }

  const random = mulberry32(seed);
  const codenames: string[] = [];

  for (let i = 0; i < count; i++) {
    const adjIndex = Math.floor(random() * adjectives.length);
    const nounIndex = Math.floor(random() * nouns.length);
    codenames.push(`${adjectives[adjIndex]}-${nouns[nounIndex]}`);
  }

  return NextResponse.json({ codenames });
}
