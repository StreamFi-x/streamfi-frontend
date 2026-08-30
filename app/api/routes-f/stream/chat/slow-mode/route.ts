import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";
import {
  setSlowMode,
  getSlowModeState,
  disableSlowMode,
  validateInterval,
} from "./utils";
import type {
  SlowModeRequestBody,
  SlowModeResponse,
  SlowModeState,
} from "./types";

const slowModeSchema = z.object({
  stream_id: z.string().min(1, "stream_id must not be empty"),
  interval_seconds: z.number(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, slowModeSchema);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const body = validation.data as SlowModeRequestBody;

  const intervalValidation = validateInterval(body.interval_seconds);
  if (!intervalValidation.valid) {
    return NextResponse.json(
      { error: intervalValidation.error },
      { status: 400 }
    );
  }

  const data = setSlowMode(body.stream_id, body.interval_seconds);
  return NextResponse.json({
    enabled: data.enabled,
    interval_seconds: data.interval_seconds,
  } as SlowModeResponse);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const streamId = new URL(req.url).searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  disableSlowMode(streamId);
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

  const data = getSlowModeState(streamId);

  if (!data) {
    return NextResponse.json({ enabled: false } as SlowModeState);
  }

  return NextResponse.json({
    enabled: data.enabled,
    interval_seconds: data.interval_seconds,
  } as SlowModeState);
}
