import { NextRequest, NextResponse } from "next/server";

type ClipSummary = {
  clip_id: string;
  title: string;
  views: number;
  likes: number;
  duration_seconds: number;
};

type MonthlyRecap = {
  creator_id: string;
  year: number;
  month: number;
  top_clips: ClipSummary[];
  total_views: number;
  total_likes: number;
  avg_duration: number;
};

function seedClips(creatorId: string, year: number, month: number): ClipSummary[] {
  const hash =
    creatorId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) +
    year * 100 +
    month;

  return Array.from({ length: 5 }, (_, i) => {
    const views = 1000 + ((hash * 31 + i * 97) % 9_000);
    const likes = Math.floor(views * (0.05 + ((hash * 13 + i * 7) % 20) / 100));
    const duration = 30 + ((hash * 17 + i * 43) % 270);
    return {
      clip_id: `clip_${creatorId.slice(0, 6)}_${year}${String(month).padStart(2, "0")}_${i + 1}`,
      title: `Clip ${i + 1} — ${year}-${String(month).padStart(2, "0")}`,
      views,
      likes,
      duration_seconds: duration,
    };
  }).sort((a, b) => b.views - a.views);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  if (!creatorId || !creatorId.trim()) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;

  const rawYear = searchParams.get("year");
  const rawMonth = searchParams.get("month");

  if (rawYear !== null || rawMonth !== null) {
    if (rawYear === null || rawMonth === null) {
      return NextResponse.json(
        { error: "Both year and month must be provided together" },
        { status: 400 },
      );
    }
    const parsedYear = parseInt(rawYear, 10);
    const parsedMonth = parseInt(rawMonth, 10);
    if (!Number.isInteger(parsedYear) || parsedYear < 2020 || parsedYear > 2100) {
      return NextResponse.json({ error: "year must be an integer between 2020 and 2100" }, { status: 400 });
    }
    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return NextResponse.json({ error: "month must be an integer between 1 and 12" }, { status: 400 });
    }
    year = parsedYear;
    month = parsedMonth;
  }

  const clips = seedClips(creatorId.trim(), year, month);
  const total_views = clips.reduce((s, c) => s + c.views, 0);
  const total_likes = clips.reduce((s, c) => s + c.likes, 0);
  const avg_duration = Math.round(
    clips.reduce((s, c) => s + c.duration_seconds, 0) / clips.length,
  );

  const recap: MonthlyRecap = {
    creator_id: creatorId.trim(),
    year,
    month,
    top_clips: clips,
    total_views,
    total_likes,
    avg_duration,
  };

  return NextResponse.json(recap);
}
