import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getSeedStreamData } from "./_lib/seed";

const querySchema = z.object({
  stream_id: z.string().min(1),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { stream_id } = queryResult.data;
  const data = getSeedStreamData(stream_id);
  if (!data) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  const peak = Math.max(...data.samples.map((s) => s.viewer_count));
  const points = data.samples.map((s) => ({
    minute: s.minute,
    percent_of_peak: peak > 0 ? Math.round((s.viewer_count / peak) * 100) : 0,
    viewer_count: s.viewer_count,
  }));

  return NextResponse.json({ points });
}