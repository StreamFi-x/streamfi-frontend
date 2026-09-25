import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type ComebackCreator = {
  creator_id: string;
  username: string;
  gap_days: number;
  last_inactive_date: string;
  return_date: string;
  streams_since_return: number;
};

type ComebackCreatorsResponse = {
  creators: ComebackCreator[];
  total: number;
};

const querySchema = z.object({
  min_gap_days: z.string().optional().default("30").transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 30 : Math.min(num, 365);
  }),
  limit: z.string().optional().default("10").transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 10 : Math.min(num, 100);
  }),
});

const CREATOR_POOL = [
  { creator_id: "c001", username: "StreamKing", gap_days: 45 },
  { creator_id: "c002", username: "NightOwlGamer", gap_days: 62 },
  { creator_id: "c003", username: "TechTalkDaily", gap_days: 90 },
  { creator_id: "c004", username: "MusicVibes", gap_days: 31 },
  { creator_id: "c005", username: "CookingWithAlex", gap_days: 120 },
  { creator_id: "c006", username: "FitnessFirst", gap_days: 55 },
  { creator_id: "c007", username: "ArtByNature", gap_days: 200 },
  { creator_id: "c008", username: "GamingGuru", gap_days: 38 },
  { creator_id: "c009", username: "TravelDiaries", gap_days: 75 },
  { creator_id: "c010", username: "CodeAndChill", gap_days: 42 },
  { creator_id: "c011", username: "BookwormReads", gap_days: 95 },
  { creator_id: "c012", username: "DIYCrafts", gap_days: 33 },
];

function buildCreator(raw: typeof CREATOR_POOL[0]): ComebackCreator {
  const baseDate = new Date("2024-06-01");
  const returnDate = new Date(baseDate);
  returnDate.setDate(returnDate.getDate() - Math.floor(raw.gap_days / 3));
  const inactiveDate = new Date(returnDate);
  inactiveDate.setDate(inactiveDate.getDate() - raw.gap_days);

  const seed = raw.creator_id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const streams_since_return = 3 + (seed % 28);

  return {
    creator_id: raw.creator_id,
    username: raw.username,
    gap_days: raw.gap_days,
    last_inactive_date: inactiveDate.toISOString().split("T")[0],
    return_date: returnDate.toISOString().split("T")[0],
    streams_since_return,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse<ComebackCreatorsResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    min_gap_days: searchParams.get("min_gap_days"),
    limit: searchParams.get("limit"),
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 }
    );
  }

  const { min_gap_days, limit } = validation.data;

  const filtered = CREATOR_POOL
    .filter((c) => c.gap_days >= min_gap_days)
    .sort((a, b) => b.gap_days - a.gap_days)
    .slice(0, limit)
    .map(buildCreator);

  return NextResponse.json({ creators: filtered, total: filtered.length });
}
