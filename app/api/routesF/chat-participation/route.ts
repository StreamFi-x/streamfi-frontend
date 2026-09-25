import { NextRequest, NextResponse } from "next/server";

function seedChatData(streamId: string): { total_viewers: number; chatters: number } {
  const hash = streamId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const total_viewers = 200 + (hash % 4_800);
  const chatterPercent = 5 + (hash % 45);
  const chatters = Math.floor((total_viewers * chatterPercent) / 100);
  return { total_viewers, chatters };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("stream_id");
  if (!streamId || !streamId.trim()) {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  const { total_viewers, chatters } = seedChatData(streamId.trim());
  const participation_percent =
    total_viewers > 0 ? Math.round((chatters / total_viewers) * 10_000) / 100 : 0;

  return NextResponse.json({
    stream_id: streamId.trim(),
    total_viewers,
    chatters,
    participation_percent,
  });
}
