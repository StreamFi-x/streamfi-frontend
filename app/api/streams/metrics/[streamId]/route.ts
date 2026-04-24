import { NextResponse } from "next/server";
import { getMuxStreamMetrics } from "@/lib/mux/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const { streamId } = await params;

    if (!streamId) {
      console.warn("[routes-f] GET /metrics missing streamId");
      return NextResponse.json(
        { error: "Stream ID is required" },
        { status: 400 }
      );
    }

    // Fetch metrics from Mux
    let metrics;
    try {
      metrics = await getMuxStreamMetrics(streamId);
    } catch (muxError) {
      console.error("[routes-f] Failed to fetch Mux metrics:", muxError);
      return NextResponse.json(
        { error: "Failed to fetch metrics from streaming service" },
        { status: 502 }
      );
    }

    return NextResponse.json({ metrics }, { status: 200 });
  } catch (error) {
    console.error("[routes-f] GET /metrics unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}