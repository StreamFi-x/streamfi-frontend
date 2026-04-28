import { NextRequest, NextResponse } from "next/server";
import { INTENSIFIERS, NEGATIONS, SENTIMENT_LEXICON } from "./_lib/lexicon";

const MAX_BYTES = 100 * 1024;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json(
      { error: "'text' must be a non-empty string" },
      { status: 400 },
    );
  }

  const bytes = new TextEncoder().encode(body.text).length;
  if (bytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `Input text exceeds ${MAX_BYTES} bytes` },
      { status: 400 },
    );
  }

  const tokens = tokenize(body.text);
  if (tokens.length === 0) {
    return NextResponse.json(
      {
        sentiment: "neutral",
        score: 0,
        positive_words: [],
        negative_words: [],
        limitations:
          "Lexicon-based analysis only; sarcasm and context-dependent meaning are limited.",
      },
      { status: 200 },
    );
  }

  let totalScore = 0;
  const positiveWords = new Set<string>();
  const negativeWords = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const base = SENTIMENT_LEXICON[token];
    if (base === undefined) continue;

    let score = base;
    const prev = tokens[i - 1];
    const prev2 = tokens[i - 2];

    if ((prev && NEGATIONS.has(prev)) || (prev2 && NEGATIONS.has(prev2))) {
      score *= -1;
    }

    if (prev && INTENSIFIERS.has(prev)) {
      score *= INTENSIFIERS.get(prev)!;
    }

    totalScore += score;
    if (score >= 0) positiveWords.add(token);
    else negativeWords.add(token);
  }

  const normalizedRaw = Math.tanh(totalScore / Math.max(tokens.length / 2, 1));
  const normalizedScore = Math.max(-1, Math.min(1, normalizedRaw));
  const roundedScore = Math.round(normalizedScore * 1000) / 1000;

  const sentiment =
    roundedScore > 0.08
      ? "positive"
      : roundedScore < -0.08
        ? "negative"
        : "neutral";

  return NextResponse.json({
    sentiment,
    score: roundedScore,
    positive_words: Array.from(positiveWords),
    negative_words: Array.from(negativeWords),
    limitations:
      "Lexicon-based analysis only; sarcasm, irony, and domain-specific context may be inaccurate.",
  });
}
