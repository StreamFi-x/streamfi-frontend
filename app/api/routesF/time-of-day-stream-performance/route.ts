/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type HourData = {
  hour_utc: number;
  avg_viewers: number;
  stream_count: number;
};

type HourPerformance = {
  hours: HourData[];
};

const querySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required")
});

function getSeededStreams(creatorId: string): Array<{ start_hour_utc: number; peak_viewers: number }> {
  const hash = creatorId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const seed = hash % 10000;

  const streams: Array<{ start_hour_utc: number; peak_viewers: number }> = [];
  for (let i = 0; i < 12; i++) {
    const pseudo = (seed * 7919 + i * 1103) % 24;
    const hour = Math.floor(pseudo);
    const viewers = 50 + ((seed * 97 + i * 311) % 450);
    streams.push({ start_hour_utc: hour, peak_viewers: viewers });
  }

  return streams;
}

function computeHourlyPerformance(streams: Array<{ start_hour_utc: number; peak_viewers: number }>): HourData[] {
  const hourMap: Record<number, { total_viewers: number; count: number }> = {};

  for (let h = 0; h < 24; h++) {
    hourMap[h] = { total_viewers: 0, count: 0 };
  }

  for (const stream of streams) {
    const hour = stream.start_hour_utc;
    hourMap[hour].total_viewers += stream.peak_viewers;
    hourMap[hour].count += 1;
  }

  const result: HourData[] = [];
  for (let h = 0; h < 24; h++) {
    const data = hourMap[h];
    result.push({
      hour_utc: h,
      avg_viewers: data.count > 0 ? Math.round(data.total_viewers / data.count * 10) / 10 : 0,
      stream_count: data.count
    });
  }

  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    creator_id: searchParams.get("creator_id")
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { creator_id } = validation.data;
  const streams = getSeededStreams(creator_id);
  const hours = computeHourlyPerformance(streams);

  return NextResponse.json({ hours });
}
