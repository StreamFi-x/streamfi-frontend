import { NextRequest, NextResponse } from "next/server";
import { getViewerEvents, getFollowEvents } from "./seedData";
import { computeConversion, isValidWindowDays } from "./utils";
import type { ConversionResponse } from "./types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creator_id");
  const windowDaysParam = searchParams.get("window_days");

  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const windowValidation = isValidWindowDays(windowDaysParam ?? undefined);
  if (!windowValidation.valid) {
    return NextResponse.json(
      { error: windowValidation.error },
      { status: 400 }
    );
  }

  const viewerEvents = getViewerEvents(creatorId);
  const followEvents = getFollowEvents(creatorId);
  const result = computeConversion(
    viewerEvents,
    followEvents,
    windowValidation.value!
  );

  return NextResponse.json(result as ConversionResponse);
}
