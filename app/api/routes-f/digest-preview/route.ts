import { NextRequest, NextResponse } from "next/server";
import { getOptIns } from "./seedData";
import { buildSections, getNextScheduledSend } from "./utils";
import type { DigestPreviewResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewer_id");

  if (!viewerId) {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }

  const optIns = getOptIns(viewerId);
  const sections = buildSections(optIns);
  const scheduled_send = getNextScheduledSend();

  return NextResponse.json({
    sections,
    scheduled_send,
  } as DigestPreviewResponse);
}
