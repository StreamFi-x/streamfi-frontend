import { type NextRequest, NextResponse } from "next/server";

type WrapBody = {
  text?: unknown;
  width?: unknown;
  hard_break?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function wrapLine(line: string, width: number, hardBreak: boolean): string[] {
  if (line.length <= width) {return [line];}

  const result: string[] = [];
  let remaining = line;

  while (remaining.length > width) {
    if (hardBreak) {
      result.push(remaining.substring(0, width));
      remaining = remaining.substring(width);
    } else {
      let breakPoint = remaining.lastIndexOf(" ", width);
      if (breakPoint <= 0) {breakPoint = width;}
      result.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint).replace(/^ /, "");
    }
  }

  if (remaining.length > 0) {result.push(remaining);}
  return result;
}

export async function POST(req: NextRequest) {
  let body: WrapBody;

  try {
    body = (await req.json()) as WrapBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { text, width, hard_break } = body;

  if (typeof text !== "string") {
    return badRequest("text must be a string.");
  }

  if (!isFiniteNumber(width) || width < 1) {
    return badRequest("width must be a positive number.");
  }

  const hardBreak = hard_break === true;
  const paragraphs = text.split("\n");
  const wrappedLines: string[] = [];

  for (const para of paragraphs) {
    if (para.length === 0) {
      wrappedLines.push("");
    } else {
      wrappedLines.push(...wrapLine(para, width, hardBreak));
    }
  }

  return NextResponse.json({
    wrapped: wrappedLines.join("\n"),
    line_count: wrappedLines.length,
  });
}
