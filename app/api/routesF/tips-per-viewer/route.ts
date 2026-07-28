import { NextRequest, NextResponse } from "next/server";

type StreamStats = {
  stream_id: string;
  viewers: number;
  tips_usdc: number;
  tips_per_viewer_usdc: number;
};

function seedStreams(creatorId: string): StreamStats[] {
  const hash = creatorId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  return Array.from({ length: 6 }, (_, i) => {
    const viewers = 100 + ((hash * 37 + i * 83) % 2_900);
    const tipsUsdc = 20 + ((hash * 53 + i * 61) % 1_980);
    const tipsPerViewer = Math.round((tipsUsdc / viewers) * 100) / 100;
    return {
      stream_id: `stream_${creatorId.slice(0, 6)}_${i + 1}`,
      viewers,
      tips_usdc: tipsUsdc,
      tips_per_viewer_usdc: tipsPerViewer,
    };
  }).sort((a, b) => b.tips_per_viewer_usdc - a.tips_per_viewer_usdc);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  if (!creatorId || !creatorId.trim()) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const streams = seedStreams(creatorId.trim());
  return NextResponse.json({ creator_id: creatorId.trim(), streams });
}
