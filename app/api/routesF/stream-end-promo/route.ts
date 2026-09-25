import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LIVE_STREAMS, overlapBetween, type LiveStream } from "./seed";

type PromotedCreator = {
  creator_id: string;
  username: string;
  stream_id: string;
  category: string;
  viewers: number;
  follower_overlap: number;
};

type PromoResponse = {
  promoted_creator: PromotedCreator | null;
  reason: string;
};

const bodySchema = z.object({
  ending_creator_id: z.string().min(1, "ending_creator_id is required"),
});

/**
 * Pick the cross-promotion candidate: the currently-live creator (other
 * than the one ending) whose community has the highest follower overlap
 * with the ending creator's. Exported for direct unit testing.
 */
export function pickCrossPromo(
  endingCreatorId: string,
  liveStreams: LiveStream[] = LIVE_STREAMS
): PromoResponse {
  const candidates = liveStreams
    .filter((s) => s.creator_id !== endingCreatorId)
    .map((s) => ({ stream: s, overlap: overlapBetween(endingCreatorId, s.creator_id) }))
    .filter((c) => c.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  const best = candidates[0];
  if (!best) {
    return {
      promoted_creator: null,
      reason: "No live creators with follower overlap right now — showing nothing rather than an irrelevant pick",
    };
  }

  const { stream, overlap } = best;
  return {
    promoted_creator: {
      creator_id: stream.creator_id,
      username: stream.username,
      stream_id: stream.stream_id,
      category: stream.category,
      viewers: stream.viewers,
      follower_overlap: overlap,
    },
    reason: `${Math.round(overlap * 100)}% of this community also follows ${stream.username}, live now in ${stream.category}`,
  };
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<PromoResponse | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = bodySchema.safeParse(raw);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  return NextResponse.json(pickCrossPromo(validation.data.ending_creator_id));
}
