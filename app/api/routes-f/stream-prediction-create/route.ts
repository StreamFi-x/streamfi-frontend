/**
 * POST /api/routes-f/stream-prediction-create
 * A creator or moderator opens a new prediction on a stream, letting
 * viewers wager on one of several outcomes until it is locked.
 */
import { NextRequest, NextResponse } from "next/server";
import type { CreatePredictionBody, CreatePredictionResponse } from "./types";
import { createPrediction } from "./store";

const MIN_OUTCOMES = 2;
const MAX_OUTCOMES = 10;
const MAX_LOCK_AFTER_SEC = 24 * 60 * 60; // 24 hours

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreatePredictionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { stream_id, question, outcomes, lock_after_sec } = body;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }
  if (!question || typeof question !== "string") {
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 }
    );
  }
  if (
    !Array.isArray(outcomes) ||
    outcomes.length < MIN_OUTCOMES ||
    outcomes.length > MAX_OUTCOMES ||
    !outcomes.every((o) => typeof o === "string" && o.trim().length > 0)
  ) {
    return NextResponse.json(
      {
        error: `outcomes must be an array of ${MIN_OUTCOMES}-${MAX_OUTCOMES} non-empty strings`,
      },
      { status: 400 }
    );
  }
  if (
    typeof lock_after_sec !== "number" ||
    !Number.isFinite(lock_after_sec) ||
    lock_after_sec <= 0 ||
    lock_after_sec > MAX_LOCK_AFTER_SEC
  ) {
    return NextResponse.json(
      {
        error: `lock_after_sec must be a positive number no greater than ${MAX_LOCK_AFTER_SEC}`,
      },
      { status: 400 }
    );
  }

  const prediction = createPrediction(
    stream_id,
    question,
    outcomes,
    lock_after_sec
  );

  return NextResponse.json(
    {
      prediction_id: prediction.prediction_id,
      locks_at: prediction.locks_at,
    } satisfies CreatePredictionResponse,
    { status: 201 }
  );
}
