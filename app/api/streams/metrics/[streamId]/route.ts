import { NextResponse } from "next/server";
import { getMuxStreamMetrics } from "@/lib/mux/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const { streamId } = await params;

    if (!streamId) {
      return NextResponse.json(
        { error: "Stream ID is required" },
        { status: 400 }
      );
    }

    const metrics = await getMuxStreamMetrics(streamId);

    return NextResponse.json({ metrics }, { status: 200 });
  } catch (error) {
    console.error("Get metrics error:", error);
    return NextResponse.json(
      { error: "Failed to get stream metrics" },
      { status: 500 }
    );
  }
}
