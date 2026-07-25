import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type ChapterSuggestion = {
  start_seconds: number;
  end_seconds: number;
  title: string;
  confidence: number;
};

type VodChapterSuggestionsResponse = {
  vod_id: string;
  duration_seconds: number;
  suggestions: ChapterSuggestion[];
};

const bodySchema = z.object({
  vod_id: z.string().min(1, "vod_id is required"),
  duration_seconds: z.number().int().positive().optional(),
});

const MAX_SUGGESTIONS = 5;

function seededInt(seed: number, index: number, range: number): number {
  return ((seed * 1103515245 + index * 12345) >>> 0) % range;
}

const CHAPTER_TITLES = [
  "Introduction",
  "Main Discussion",
  "Q&A Session",
  "Live Demo",
  "Special Guest Segment",
  "Community Highlights",
  "Game Highlights",
  "Tutorial Walkthrough",
  "Behind the Scenes",
  "Wrap-Up & Closing",
];

function generateSuggestions(vodId: string, duration: number): ChapterSuggestion[] {
  const seed = vodId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const count = MAX_SUGGESTIONS;

  const breakpoints: number[] = [0];
  const minChapterLen = Math.floor(duration / (count + 1));

  for (let i = 1; i < count; i++) {
    const jitter = seededInt(seed, i, Math.max(1, minChapterLen / 2));
    const next = breakpoints[i - 1] + minChapterLen + jitter;
    if (next < duration - minChapterLen) {
      breakpoints.push(next);
    }
  }
  breakpoints.push(duration);

  const suggestions: ChapterSuggestion[] = [];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const start_seconds = breakpoints[i];
    const end_seconds = breakpoints[i + 1];
    const titleIndex = seededInt(seed, i * 7, CHAPTER_TITLES.length);
    const confidence = Math.round((65 + seededInt(seed, i * 13, 35)) / 100 * 100) / 100;

    suggestions.push({
      start_seconds,
      end_seconds,
      title: CHAPTER_TITLES[titleIndex],
      confidence,
    });
  }

  return suggestions;
}

export async function POST(req: NextRequest): Promise<NextResponse<VodChapterSuggestionsResponse | { error: string }>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = bodySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.flatten() } as unknown as { error: string },
      { status: 400 }
    );
  }

  const { vod_id, duration_seconds } = validation.data;
  const duration = duration_seconds ?? 3600;

  const suggestions = generateSuggestions(vod_id, duration);

  return NextResponse.json({ vod_id, duration_seconds: duration, suggestions });
}
