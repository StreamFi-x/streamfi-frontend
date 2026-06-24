import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "../../_lib/validate";
import { z } from "zod";
import {
  setSubscribersOnlyRestriction,
  getSubscribersOnlyState,
  disableSubscribersOnlyRestriction,
  validateTierId,
} from "./utils";
import type {
  SubscribersOnlyRequestBody,
  SubscribersOnlyResponse,
  SubscribersOnlyState,
} from "./types";

const subscribersOnlySchema = z.object({
  stream_id: z.string().min(1, "stream_id must not be empty"),
  tier_id: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, subscribersOnlySchema);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const body = validation.data as SubscribersOnlyRequestBody;

  const tierIdValidation = validateTierId(body.tier_id);
  if (!tierIdValidation.valid) {
    return NextResponse.json(
      { error: tierIdValidation.error },
      { status: 400 }
    );
  }

  const data = setSubscribersOnlyRestriction(body.stream_id, body.tier_id);
  return NextResponse.json({
    enabled: data.enabled,
    tier_id: data.tier_id,
  } as SubscribersOnlyResponse);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  disableSubscribersOnlyRestriction(streamId);
  return NextResponse.json({ enabled: false });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const data = getSubscribersOnlyState(streamId);

  if (!data) {
    return NextResponse.json({ enabled: false } as SubscribersOnlyState);
  }

  return NextResponse.json({
    enabled: data.enabled,
    tier_id: data.tier_id,
  } as SubscribersOnlyState);
}
