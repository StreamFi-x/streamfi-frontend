/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { recordClick, getStreamStats, ImpressionSource } from "../route";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { stream_id, source } = body;

    if (!stream_id) {
      return NextResponse.json(
        { error: "stream_id is required" },
        { status: 400 }
      );
    }

    if (!source || !["explore", "category", "search"].includes(source)) {
      return NextResponse.json(
        { error: "source must be one of: explore, category, search" },
        { status: 400 }
      );
    }

    recordClick(stream_id, source as ImpressionSource);
    return NextResponse.json({
      success: true,
      action: "click",
      stream_id,
      source,
      stats: getStreamStats(stream_id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
