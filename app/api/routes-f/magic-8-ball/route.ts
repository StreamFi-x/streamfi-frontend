import { NextRequest, NextResponse } from "next/server";
import { pickRandom, validateQuestion } from "./_lib/helpers";

// In-memory counter — shared across requests within the same server instance
export let totalAsks = 0;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const error = validateQuestion(body?.question);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  totalAsks += 1;
  const { text, category } = pickRandom();

  return NextResponse.json({
    question: body.question as string,
    answer: text,
    category,
  });
}
