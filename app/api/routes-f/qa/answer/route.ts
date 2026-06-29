import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { getStore } from "../_lib/store";

const answerSchema = z.object({
  question_id: z.string().min(1),
  creator_id: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, answerSchema);
  if (result instanceof NextResponse) return result;

  const { question_id, creator_id } = result.data;
  const question = getStore().get(question_id);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  if (question.answered) {
    return NextResponse.json({ error: "Already answered" }, { status: 409 });
  }

  question.answered = true;
  question.answered_by = creator_id;
  question.answered_at = new Date().toISOString();

  return NextResponse.json({ message: "Marked as answered" });
}
