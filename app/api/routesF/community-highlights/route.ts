import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type CommunityHighlight = {
  highlight_id: string;
  title: string;
  creator_id: string;
  creator_username: string;
  votes: number;
  category: string;
  created_at: string;
};

type CommunityHighlightsResponse = {
  highlights: CommunityHighlight[];
  total: number;
  window_days: number;
};

const querySchema = z.object({
  window_days: z.string().optional().default("7").transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 7 : Math.min(num, 90);
  }),
  limit: z.string().optional().default("20").transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 20 : Math.min(num, 100);
  }),
  category: z.string().optional(),
});

const HIGHLIGHT_POOL: Array<Omit<CommunityHighlight, "created_at"> & { days_ago: number }> = [
  { highlight_id: "h001", title: "Epic 1v5 clutch moment", creator_id: "c001", creator_username: "StreamKing", votes: 2840, category: "gaming", days_ago: 1 },
  { highlight_id: "h002", title: "Live cooking disaster turned masterpiece", creator_id: "c005", creator_username: "CookingWithAlex", votes: 1920, category: "cooking", days_ago: 2 },
  { highlight_id: "h003", title: "Surprise celebrity appearance mid-stream", creator_id: "c009", creator_username: "TravelDiaries", votes: 3510, category: "irl", days_ago: 3 },
  { highlight_id: "h004", title: "World record speedrun attempt", creator_id: "c008", creator_username: "GamingGuru", votes: 4200, category: "gaming", days_ago: 4 },
  { highlight_id: "h005", title: "Original song debuted live", creator_id: "c004", creator_username: "MusicVibes", votes: 2100, category: "music", days_ago: 5 },
  { highlight_id: "h006", title: "Completing 100 pushups challenge on stream", creator_id: "c006", creator_username: "FitnessFirst", votes: 980, category: "fitness", days_ago: 6 },
  { highlight_id: "h007", title: "Speed-coding a full app in 2 hours", creator_id: "c010", creator_username: "CodeAndChill", votes: 1750, category: "tech", days_ago: 7 },
  { highlight_id: "h008", title: "Incredible fan art revealed live", creator_id: "c007", creator_username: "ArtByNature", votes: 1340, category: "art", days_ago: 10 },
  { highlight_id: "h009", title: "Viewers pick next travel destination live", creator_id: "c009", creator_username: "TravelDiaries", votes: 890, category: "irl", days_ago: 14 },
  { highlight_id: "h010", title: "Book club live reading finale", creator_id: "c011", creator_username: "BookwormReads", votes: 670, category: "education", days_ago: 20 },
  { highlight_id: "h011", title: "DIY project failure becomes viral moment", creator_id: "c012", creator_username: "DIYCrafts", votes: 2290, category: "creative", days_ago: 25 },
  { highlight_id: "h012", title: "1000-subscriber milestone celebration", creator_id: "c002", creator_username: "NightOwlGamer", votes: 1560, category: "milestone", days_ago: 30 },
];

function toCreatedAt(daysAgo: number): string {
  const date = new Date("2024-06-01");
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

export async function GET(req: NextRequest): Promise<NextResponse<CommunityHighlightsResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    window_days: searchParams.get("window_days"),
    limit: searchParams.get("limit"),
    category: searchParams.get("category"),
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 }
    );
  }

  const { window_days, limit, category } = validation.data;

  let filtered = HIGHLIGHT_POOL.filter((h) => h.days_ago <= window_days);

  if (category) {
    filtered = filtered.filter((h) => h.category === category);
  }

  const highlights = filtered
    .sort((a, b) => b.votes - a.votes)
    .slice(0, limit)
    .map(({ days_ago, ...h }) => ({ ...h, created_at: toCreatedAt(days_ago) }));

  return NextResponse.json({ highlights, total: highlights.length, window_days });
}
