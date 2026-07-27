import { NextRequest, NextResponse } from "next/server";

type CountryEntry = {
  country: string;
  viewers: number;
  percent: number;
};

const SEED_COUNTRIES = [
  "US", "NG", "GB", "CA", "AU", "DE", "IN", "BR", "PH", "KE",
];

function seedGeoData(streamId: string): CountryEntry[] {
  const hash = streamId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const rawCounts = SEED_COUNTRIES.map((country, i) => ({
    country,
    viewers: 50 + ((hash * 43 + i * 89) % 950),
  })).sort((a, b) => b.viewers - a.viewers);

  const total = rawCounts.reduce((sum, c) => sum + c.viewers, 0);
  return rawCounts.map((c) => ({
    ...c,
    percent: total > 0 ? Math.round((c.viewers / total) * 10_000) / 100 : 0,
  }));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("stream_id");
  if (!streamId || !streamId.trim()) {
    return NextResponse.json({ error: "stream_id is required" }, { status: 400 });
  }

  const by_country = seedGeoData(streamId.trim());
  return NextResponse.json({ stream_id: streamId.trim(), by_country });
}
