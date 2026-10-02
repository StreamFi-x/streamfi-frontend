import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { getStore } from "../_lib/store";

const upvoteSchema = z.object({
  question_id: z.string().min(1),
  viewer_id: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, upvoteSchema);
  if (result instanceof NextResponse) {return result;}

  const { question_id, viewer_id } = result.data;
  const question = getStore().get(question_id);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  if (question.upvoters.has(viewer_id)) {
    return NextResponse.json({ error: "Already upvoted" }, { status: 409 });
  }

  question.upvoters.add(viewer_id);
  question.score++;

  return NextResponse.json({ message: "Upvoted", score: question.score });
}
