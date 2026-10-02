import { NextRequest, NextResponse } from "next/server";
import { getHistoryForStream } from "./seedData";
import { computeReturningStats } from "./utils";
import type { ReturningViewersResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const records = getHistoryForStream(streamId);
  const stats = computeReturningStats(records);

  return NextResponse.json(stats as ReturningViewersResponse);
}
