import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type FreshStream = {
  stream_id: string;
  creator_id: string;
  creator_username: string;
  title: string;
  category: string;
  viewer_count: number;
  age_minutes: number;
  started_at: string;
};

type FreshStreamsResponse = {
  streams: FreshStream[];
  total: number;
  max_age_minutes: number;
};

const querySchema = z.object({
  max_age_minutes: z.string().optional().default("30").transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 30 : Math.min(num, 60);
  }),
  limit: z.string().optional().default("20").transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 20 : Math.min(num, 100);
  }),
});

const STREAM_POOL: Array<Omit<FreshStream, "started_at">> = [
  { stream_id: "s001", creator_id: "c001", creator_username: "PixelNinja", title: "Late Night Grind Session", category: "gaming", viewer_count: 42, age_minutes: 2 },
  { stream_id: "s002", creator_id: "c002", creator_username: "StellarBeats", title: "Lo-Fi Coding Stream", category: "music", viewer_count: 118, age_minutes: 5 },
  { stream_id: "s003", creator_id: "c003", creator_username: "CryptoTalk", title: "XLM Analysis Live", category: "finance", viewer_count: 230, age_minutes: 8 },
  { stream_id: "s004", creator_id: "c004", creator_username: "ArtFlows", title: "Character Design — Ep 12", category: "art", viewer_count: 67, age_minutes: 12 },
  { stream_id: "s005", creator_id: "c005", creator_username: "SpeedRunner", title: "Any% Attempt #88", category: "gaming", viewer_count: 504, age_minutes: 15 },
  { stream_id: "s006", creator_id: "c006", creator_username: "DevStream", title: "Building a REST API from scratch", category: "tech", viewer_count: 89, age_minutes: 18 },
  { stream_id: "s007", creator_id: "c007", creator_username: "ChefOnAir", title: "Sunday Pasta Night", category: "cooking", viewer_count: 155, age_minutes: 22 },
  { stream_id: "s008", creator_id: "c008", creator_username: "FitWithKemi", title: "Morning HIIT — Day 5", category: "fitness", viewer_count: 73, age_minutes: 25 },
  { stream_id: "s009", creator_id: "c009", creator_username: "NightOwl", title: "Chatting about nothing", category: "just-chatting", viewer_count: 310, age_minutes: 28 },
  { stream_id: "s010", creator_id: "c010", creator_username: "QuizMaster", title: "Trivia Friday!", category: "games", viewer_count: 198, age_minutes: 35 },
  { stream_id: "s011", creator_id: "c011", creator_username: "TechTutor", title: "React hooks deep dive", category: "tech", viewer_count: 61, age_minutes: 45 },
  { stream_id: "s012", creator_id: "c012", creator_username: "BookNerd", title: "Reading Dune aloud", category: "education", viewer_count: 44, age_minutes: 55 },
];

const REFERENCE_TIME = new Date("2024-07-01T12:00:00Z");

function toStartedAt(ageMinutes: number): string {
  const d = new Date(REFERENCE_TIME.getTime() - ageMinutes * 60_000);
  return d.toISOString();
}

export async function GET(req: NextRequest): Promise<NextResponse<FreshStreamsResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    max_age_minutes: searchParams.get("max_age_minutes"),
    limit: searchParams.get("limit"),
  });

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { max_age_minutes, limit } = validation.data;

  const streams = STREAM_POOL
    .filter((s) => s.age_minutes <= max_age_minutes)
    .slice(0, limit)
    .map(({ age_minutes, ...s }) => ({
      ...s,
      age_minutes,
      started_at: toStartedAt(age_minutes),
    }));

  return NextResponse.json({ streams, total: streams.length, max_age_minutes });
}
