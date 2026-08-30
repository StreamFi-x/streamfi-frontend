/**
 * POST /api/routes-f/stream-prediction-cancel
 * A moderator cancels an open or locked prediction, refunding every
 * viewer's staked channel points in full. Cannot cancel a prediction that
 * has already resolved (payouts already happened) or was already cancelled.
 */
import { NextRequest, NextResponse } from "next/server";
import type { CancelPredictionBody, CancelPredictionResponse } from "./types";
import {
  cancelPrediction,
  ModeratorNotAuthorizedError,
  PredictionNotFoundError,
  PredictionAlreadyResolvedError,
  PredictionAlreadyCancelledError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CancelPredictionBody;
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
    const { prediction, refunds } = cancelPrediction(prediction_id, moderator_id);
    return NextResponse.json({ prediction, refunds } as CancelPredictionResponse);
  } catch (error) {
    if (error instanceof PredictionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ModeratorNotAuthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (
      error instanceof PredictionAlreadyResolvedError ||
      error instanceof PredictionAlreadyCancelledError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
