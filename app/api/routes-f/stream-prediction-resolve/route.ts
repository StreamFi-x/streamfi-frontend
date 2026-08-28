/**
 * POST /api/routes-f/stream-prediction-resolve
 * A moderator resolves a locked prediction by declaring the winning
 * outcome. The full channel-points pot (winning + losing stakes) is
 * distributed to viewers who staked on the winning outcome, proportional
 * to their share of the winning side's total stake.
 */
import { NextRequest, NextResponse } from "next/server";
import type { ResolvePredictionBody, ResolvePredictionResponse } from "./types";
import {
  resolvePrediction,
  ModeratorNotAuthorizedError,
  PredictionNotFoundError,
  PredictionNotResolvableError,
  InvalidWinningOutcomeError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ResolvePredictionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { prediction_id, moderator_id, winningOutcome } = body;

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
  if (!winningOutcome || typeof winningOutcome !== "string") {
    return NextResponse.json(
      { error: "winningOutcome is required" },
      { status: 400 }
    );
  }

  try {
    const { prediction, payouts } = resolvePrediction(
      prediction_id,
      moderator_id,
      winningOutcome
    );
    return NextResponse.json({ prediction, payouts } as ResolvePredictionResponse);
  } catch (error) {
    if (error instanceof PredictionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ModeratorNotAuthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof InvalidWinningOutcomeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof PredictionNotResolvableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
