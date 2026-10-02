import { NextRequest, NextResponse } from "next/server";

export type StreamData = {
  id: string;
  title: string;
  creator: string;
  current_viewers: number;
  past_viewers: number; // Viewers at previous timestamp for velocity
};

export const SEED_STREAMS: StreamData[] = [
  {
    id: "stream-1",
    title: "Flat Stream",
    creator: "CreatorA",
    current_viewers: 100,
    past_viewers: 100,
  },
  {
    id: "stream-2",
    title: "Trending Stream",
    creator: "CreatorB",
    current_viewers: 150,
    past_viewers: 50, // Velocity = 100
  },
  {
    id: "stream-3",
    title: "Declining Stream",
    creator: "CreatorC",
    current_viewers: 120,
    past_viewers: 200, // Velocity = -80
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  const scoredStreams = SEED_STREAMS.map((stream) => {
    const viewer_velocity = stream.current_viewers - stream.past_viewers;
    const score = stream.current_viewers * 0.6 + viewer_velocity * 0.4;
    return {
      ...stream,
      score,
      viewer_velocity,
    };
  });

  scoredStreams.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    streams: scoredStreams.slice(0, limit),
  });
}
