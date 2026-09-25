/**
 * POST /api/routes-f/stream-prediction-lock
 * A moderator locks an open prediction, closing it to new entries.
 */
import { NextRequest, NextResponse } from "next/server";
import type { LockPredictionBody, LockPredictionResponse } from "./types";
import {
  lockPrediction,
  ModeratorNotAuthorizedError,
  PredictionNotFoundError,
  PredictionNotOpenError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: LockPredictionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { prediction_id, moderator_id } = body;

  if (!prediction_id || typeof prediction_id !== "string") {
    return NextResponse.json(
      { error: "prediction_id is required" },
      { status: 400 }
    );
  }
  if (!moderator_id || typeof moderator_id !== "string") {
    return NextResponse.json(
      { error: "moderator_id is required" },
      { status: 400 }
    );
  }

  try {
    const prediction = lockPrediction(prediction_id, moderator_id);
    return NextResponse.json({ prediction } as LockPredictionResponse);
  } catch (error) {
    if (error instanceof PredictionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ModeratorNotAuthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof PredictionNotOpenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
