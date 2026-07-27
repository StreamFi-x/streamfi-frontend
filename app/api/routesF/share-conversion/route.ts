import { NextRequest, NextResponse } from "next/server";

type ShareSource = {
  source: string;
  shares: number;
  viewers: number;
  conversion_percent: number;
};

const SOURCES = ["twitter", "discord", "reddit", "telegram", "direct"];

function seedShareData(streamId: string): ShareSource[] {
  const hash = streamId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  return SOURCES.map((source, i) => {
    const shares = 10 + ((hash * 41 + i * 71) % 490);
    const viewersFromShares = Math.floor((shares * (5 + ((hash * 17 + i * 29) % 45))) / 100);
    const viewers = Math.min(viewersFromShares, shares);
    const conversion_percent =
      shares > 0 ? Math.round((viewers / shares) * 10_000) / 100 : 0;
    return { source, shares, viewers, conversion_percent };
  }).sort((a, b) => b.viewers - a.viewers);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("stream_id");
  if (!streamId || !streamId.trim()) {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  const by_source = seedShareData(streamId.trim());
  return NextResponse.json({ stream_id: streamId.trim(), by_source });
}
