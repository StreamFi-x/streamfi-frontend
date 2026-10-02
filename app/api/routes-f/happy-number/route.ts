import { NextRequest, NextResponse } from "next/server";
import { analyzeHappyNumber, parsePositiveInteger } from "./happy";

// #863 feat(routes-f): happy number checker

export async function GET(req: NextRequest) {
  const nParam = new URL(req.url).searchParams.get("n");
  const n = parsePositiveInteger(nParam);

  if (n === null) {
    return NextResponse.json(
      { error: "n must be a positive integer." },
      { status: 400 }
    );
  }

  return NextResponse.json(analyzeHappyNumber(n));
}
