/* eslint-disable @typescript-eslint/no-unused-vars */
import { type NextRequest, NextResponse } from "next/server";

type SentenceCaseBody = {
  text?: unknown;
};

const ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "jr.",
  "sr.",
  "prof.",
  "rev.",
  "st.",
  "mt.",
  "no.",
  "gov.",
  "sen.",
  "rep.",
  "pres.",
  "inc.",
  "ltd.",
  "co.",
  "corp.",
  "e.g.",
  "i.e.",
  "etc.",
  "vs.",
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "jun.",
  "jul.",
  "aug.",
  "sep.",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.text !== "string") {
    return null;
  }

  return record.text;
}

function isLetter(char: string) {
  return /^[a-zA-Z]$/.test(char);
}

function isBoundaryCharacter(char: string) {
  return (
    char === '"' || char === "'" || char === ")" || char === "]" || char === "}"
  );
}

function getTokenBeforeDot(text: string, index: number) {
  let j = index - 1;
  while (j >= 0 && /[A-Za-z.]/.test(text[j])) {
    j -= 1;
  }
  return text.slice(j + 1, index + 1).toLowerCase();
}

function isAbbreviation(text: string, index: number): boolean {
  if (text[index] !== ".") {
    return false;
  }

  const token = getTokenBeforeDot(text, index);
  if (ABBREVIATIONS.has(token)) {
    return true;
  }

  return /^[a-z](?:\.[a-z])+$/.test(token);
}

function isSentenceBoundary(text: string, index: number): boolean {
  const punctuation = text[index];
  if (punctuation === ".") {
    if (isAbbreviation(text, index)) {
      return false;
    }
  }

  let j = index + 1;
  while (
    j < text.length &&
    (text[j] === " " ||
      text[j] === "\t" ||
      text[j] === "\n" ||
      isBoundaryCharacter(text[j]))
  ) {
    j += 1;
  }

  return j >= text.length || isLetter(text[j]);
}

function sentenceCase(text: string): string {
  let result = "";
  let capitalizeNext = true;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    let output = char;

    if (capitalizeNext && isLetter(char)) {
      output = char.toUpperCase();
      capitalizeNext = false;
    }

    result += output;

    if (char === "." || char === "!" || char === "?") {
      if (isSentenceBoundary(text, index)) {
        capitalizeNext = true;
      }
    }

    if (
      !capitalizeNext &&
      char !== " " &&
      char !== "\t" &&
      char !== "\n" &&
      !isBoundaryCharacter(char)
    ) {
      // Continue until we hit sentence-ending punctuation.
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const text = parseBody(body);
  if (text === null) {
    return badRequest("text must be a string.");
  }

  return NextResponse.json({ result: sentenceCase(text) });
}
