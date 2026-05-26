import { type NextRequest, NextResponse } from "next/server";
import { convertCase } from "./data";

// Kept here (not in data.ts) so jest.mock('../case-convert/data') doesn't shadow it
const VALID_TARGETS = [
  "camelCase",
  "snake_case",
  "kebab-case",
  "PascalCase",
  "CONSTANT_CASE",
  "Title Case",
  "Sentence case",
] as const;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("text" in body)) {
    return NextResponse.json({ error: "Invalid request body: 'text' is required" }, { status: 400 });
  }

  const { text, target } = body as { text: unknown; target?: unknown };

  if (typeof text !== "string") {
    return NextResponse.json({ error: "Invalid request body: 'text' must be a string" }, { status: 400 });
  }

  if (target !== undefined && !VALID_TARGETS.includes(target as never)) {
    return NextResponse.json(
      { error: `Invalid target case. Must be one of: ${VALID_TARGETS.join(", ")}` },
      { status: 400 }
    );
  }

  return NextResponse.json(convertCase(text, target as string | undefined));
}
