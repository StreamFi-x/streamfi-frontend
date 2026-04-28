import { NextRequest, NextResponse } from "next/server";
import {
  contrastRatio,
  parseColor,
  roundToTwo,
  wcagLevels,
} from "./_lib/helpers";
import type { ContrastRequest, ContrastResponse } from "./_lib/types";
export async function POST(req: NextRequest) {
  let body: ContrastRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (
    typeof body?.foreground !== "string" ||
    typeof body?.background !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "foreground and background must be color strings in hex or rgb() format.",
      },
      { status: 400 }
    );
  }
  const foreground = parseColor(body.foreground);
  const background = parseColor(body.background);
  if (!foreground || !background) {
    return NextResponse.json(
      { error: "Invalid color format. Use hex or rgb()." },
      { status: 400 }
    );
  }
  const rawRatio = contrastRatio(foreground, background);
  const response: ContrastResponse = {
    ratio: roundToTwo(rawRatio),
    levels: wcagLevels(rawRatio),
  };
  return NextResponse.json(response);
}
