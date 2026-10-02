/**
 * POST /api/routes-f/stream-quiz-create
 * Creates a stream quiz from a list of questions, each with its answer
 * options and the index of the correct one. Returns the new quiz's id.
 */
import { NextRequest, NextResponse } from "next/server";
import type { CreateQuizBody, CreateQuizResponse } from "./types";
import { createQuiz, InvalidQuestionsError } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreateQuizBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { stream_id, questions } = body;

  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  try {
    const quiz = createQuiz(stream_id, questions);
    return NextResponse.json(
      { quizId: quiz.quiz_id } as CreateQuizResponse,
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InvalidQuestionsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
