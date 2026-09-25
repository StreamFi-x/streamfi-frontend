import { NextRequest, NextResponse } from 'next/server';

export interface SeedLanguageStream {
  stream_id: string;
  creator_id: string;
  title: string;
  language: string;
  viewers: number;
}

// Seed live streams tagged with a primary language, bundled per the
// routesF scope constraint.
export const SEED_LANGUAGE_STREAMS: SeedLanguageStream[] = [
  { stream_id: 'lang-1', creator_id: 'creator-1', title: 'Ranked grind', language: 'en', viewers: 1200 },
  { stream_id: 'lang-2', creator_id: 'creator-2', title: 'Charla y juego', language: 'es', viewers: 640 },
  { stream_id: 'lang-3', creator_id: 'creator-3', title: 'Musique et discussion', language: 'fr', viewers: 310 },
  { stream_id: 'lang-4', creator_id: 'creator-4', title: 'Late night lofi', language: 'en', viewers: 890 },
  { stream_id: 'lang-5', creator_id: 'creator-5', title: 'Cocina en vivo', language: 'es', viewers: 75 },
];

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const language = searchParams.get('language');

  if (language !== null && !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
    return NextResponse.json(
      { error: `Unknown language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` },
      { status: 400 }
    );
  }

  const streams = SEED_LANGUAGE_STREAMS
    .filter((s) => (language === null ? true : s.language === language))
    .sort((a, b) => b.viewers - a.viewers);

  return NextResponse.json({ streams });
}
