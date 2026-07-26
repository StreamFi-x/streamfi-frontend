import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Badge = {
  slug: string;
  name: string;
  earned_at: string;
};

type BadgeShowcaseResponse = {
  badges: Badge[];
};

const querySchema = z.object({
  creator_id: z.string().min(1),
});

// Seed badge awards bundled inside the folder (scope constraint):
// creator_id -> badges earned on the platform.
const BADGE_AWARDS: Record<string, Badge[]> = {
  c001: [
    { slug: "first-stream", name: "First Stream", earned_at: "2024-01-05T18:30:00Z" },
    { slug: "100-followers", name: "100 Followers", earned_at: "2024-02-14T09:12:00Z" },
    { slug: "tip-magnet", name: "Tip Magnet", earned_at: "2024-05-20T21:45:00Z" },
    { slug: "marathon-streamer", name: "Marathon Streamer", earned_at: "2024-03-30T02:10:00Z" },
  ],
  c002: [
    { slug: "first-stream", name: "First Stream", earned_at: "2024-03-01T12:00:00Z" },
    { slug: "night-owl", name: "Night Owl", earned_at: "2024-03-18T03:22:00Z" },
  ],
  c003: [
    { slug: "first-stream", name: "First Stream", earned_at: "2024-04-11T16:05:00Z" },
    { slug: "stellar-supporter", name: "Stellar Supporter", earned_at: "2024-06-02T14:40:00Z" },
    { slug: "community-builder", name: "Community Builder", earned_at: "2024-05-01T10:00:00Z" },
  ],
};

export async function GET(
  req: NextRequest
): Promise<NextResponse<BadgeShowcaseResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    creator_id: searchParams.get("creator_id") ?? undefined,
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const { creator_id } = validation.data;

  const badges = [...(BADGE_AWARDS[creator_id] ?? [])].sort(
    (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
  );

  return NextResponse.json({ badges });
}
