import { NextRequest, NextResponse } from "next/server";
import {
  CANDIDATES,
  selectByWeight,
  getCurrentRotationId,
  advanceRotation,
  getRotatesAt,
} from "./helpers";
import type { FeaturedChannelResponse } from "./types";

// GET — return the current featured creator for the active rotation
export async function GET(): Promise<NextResponse> {
  const rotation_id = getCurrentRotationId();
  const featured_creator = selectByWeight(CANDIDATES, rotation_id);
  const rotates_at = getRotatesAt();

  const body: FeaturedChannelResponse = {
    featured_creator,
    rotation_id,
    rotates_at,
  };

  return NextResponse.json(body);
}

// POST /next — advance to the next rotation and return the new state
export async function POST(): Promise<NextResponse> {
  const rotation_id = advanceRotation();
  const rotates_at = getRotatesAt();

  return NextResponse.json({ rotation_id, rotates_at });
}
