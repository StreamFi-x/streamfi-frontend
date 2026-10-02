import { NextRequest, NextResponse } from "next/server";
import { bruteForceCaesar, type CaesarCandidate } from "./caesar";
import { englishLikenessScore } from "./score";

// #889 feat(routesF): caesar cipher brute force

type CaesarBody = {
  text?: unknown;
  score?: unknown;
};

const MAX_INPUT_BYTES = 10 * 1024;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function rankCandidates(candidates: CaesarCandidate[]): CaesarCandidate[] {
  return [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export async function POST(req: NextRequest) {
  let body: CaesarBody;

  try {
    body = (await req.json()) as CaesarBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { text, score } = body;

  if (typeof text !== "string") {
    return badRequest("text must be a string.");
  }

  if (getByteLength(text) > MAX_INPUT_BYTES) {
    return badRequest("text must not exceed 10KB.");
  }

  if (score !== undefined && typeof score !== "boolean") {
    return badRequest("score must be a boolean when provided.");
  }

  const includeScore = score === true;
  let candidates = bruteForceCaesar(text);

  if (includeScore) {
    candidates = rankCandidates(
      candidates.map((candidate) => ({
        ...candidate,
        score: englishLikenessScore(candidate.text),
      }))
    );
  }

  return NextResponse.json({ candidates });
}
