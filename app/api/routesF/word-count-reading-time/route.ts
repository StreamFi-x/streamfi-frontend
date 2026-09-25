/* eslint-disable @typescript-eslint/no-unused-vars */
import { type NextRequest, NextResponse } from "next/server";

type WordCountBody = {
  text?: unknown;
  wpm?: unknown;
};

const MAX_BYTES = 1024 * 1024;
const DEFAULT_WPM = 200;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseBody(body: unknown): { text: string; wpm: number } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.text !== "string") {
    return null;
  }

  const encoder = new TextEncoder();
  const byteLength = encoder.encode(record.text).length;
  if (byteLength > MAX_BYTES) {
    throw new Error("TEXT_TOO_LARGE");
  }

  let wpm = DEFAULT_WPM;
  if (record.wpm !== undefined) {
    if (
      typeof record.wpm !== "number" ||
      !Number.isInteger(record.wpm) ||
      record.wpm <= 0
    ) {
      return null;
    }
    wpm = record.wpm;
  }

  return { text: record.text, wpm };
}

function countWords(text: string) {
  const matches = text.match(/\b[\p{L}\p{N}']+\b/gu);
  return matches ? matches.length : 0;
}

function countSentences(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const matches = trimmed.match(/[^.!?]+[.!?]+/g);
  if (matches && matches.length > 0) {
    const remainder = trimmed
      .slice(
        trimmed.lastIndexOf(matches[matches.length - 1]) +
          matches[matches.length - 1].length
      )
      .trim();
    return remainder ? matches.length + 1 : matches.length;
  }

  return 1;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  let parsed: { text: string; wpm: number } | null;
  try {
    parsed = parseBody(body);
  } catch (error) {
    if (error instanceof Error && error.message === "TEXT_TOO_LARGE") {
      return badRequest("text must be at most 1MB.");
    }
    return badRequest("Invalid request body.");
  }

  if (!parsed) {
    return badRequest(
      "text must be a string and wpm must be a positive integer."
    );
  }

  const { text, wpm } = parsed;
  const characters = Array.from(text).length;
  const charactersNoSpaces = Array.from(text.replace(/\s+/g, "")).length;
  const words = countWords(text);
  const sentences = countSentences(text);
  const readingTimeSeconds = words === 0 ? 0 : Math.ceil((words / wpm) * 60);

  return NextResponse.json({
    words,
    characters,
    characters_no_spaces: charactersNoSpaces,
    sentences,
    reading_time_seconds: readingTimeSeconds,
  });
}
