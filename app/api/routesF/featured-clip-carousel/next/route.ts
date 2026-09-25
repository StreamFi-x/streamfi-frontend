import { NextResponse } from "next/server";
import {
  advanceCarouselRotation,
  computeRotatesAt,
  selectClipsForRotation,
  type CarouselResponse,
} from "../route";

export async function POST(): Promise<NextResponse<CarouselResponse>> {
  const rotation_id = advanceCarouselRotation();
  const clips = selectClipsForRotation(rotation_id);
  const rotates_at = computeRotatesAt();

  return NextResponse.json({ clips, rotation_id, rotates_at });
}
