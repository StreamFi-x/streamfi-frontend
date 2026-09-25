/**
 * POST /api/routes-f/stream-quiz-submit
 * A viewer submits their answers for a stream quiz (created via
 * stream-quiz-create). Returns the viewer's score and their rank among
 * all submissions received so far for that quiz.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SubmitQuizBody, SubmitQuizResponse } from "./types";
import {
  submitQuizAnswer,
  QuizNotFoundError,
  InvalidAnswerError,
  AlreadySubmittedError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: SubmitQuizBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { quizId, viewer_id, answer } = body;

  if (!quizId || typeof quizId !== "string") {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }
  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(answer)) {
    return NextResponse.json(
      { error: "answer must be an array" },
      { status: 400 }
    );
  }

  try {
    const { score, total, rank } = submitQuizAnswer(quizId, viewer_id, answer);
    return NextResponse.json({ score, total, rank } satisfies SubmitQuizResponse);
  } catch (error) {
    if (error instanceof QuizNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidAnswerError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AlreadySubmittedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
