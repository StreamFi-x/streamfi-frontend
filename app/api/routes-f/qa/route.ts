import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getStore, Question } from "./_lib/store";

const submitSchema = z.object({
  stream_id: z.string().min(1),
  viewer_id: z.string().min(1),
  question: z.string().min(1),
});

const getSchema = z.object({
  stream_id: z.string().min(1),
});

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `q_${ts}_${rand}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, submitSchema);
  if (result instanceof NextResponse) {return result;}

  const { stream_id, viewer_id, question } = result.data;

  const id = generateId();
  const now = new Date().toISOString();

  const q: Question = {
    id,
    stream_id,
    viewer_id,
    question,
    score: 0,
    answered: false,
    queued_at: now,
    upvoters: new Set(),
  };

  getStore().set(id, q);

  return NextResponse.json({ question_id: id, queued_at: now });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const result = validateQuery(new URL(req.url).searchParams, getSchema);
  if (result instanceof NextResponse) {return result;}

  const { stream_id } = result.data;
  const store = getStore();

  const pending = Array.from(store.values())
    .filter((q) => q.stream_id === stream_id && !q.answered)
    .sort((a, b) => new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime())
    .map(({ upvoters, ...rest }) => ({
      ...rest,
      upvotes: upvoters.size,
    }));

  return NextResponse.json({ questions: pending });
}
