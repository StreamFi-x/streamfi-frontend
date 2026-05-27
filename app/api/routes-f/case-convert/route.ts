import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

/**
 * Supported output targets.
 * Kept local so tests mocking external modules don't shadow it.
 */
const VALID_TARGETS = [
  "camelCase",
  "snake_case",
  "kebab-case",
  "PascalCase",
  "CONSTANT_CASE",
  "Title Case",
  "Sentence case",
] as const;

export type CaseTarget = (typeof VALID_TARGETS)[number];

/**
 * Split text into lowercase words while handling:
 * - camelCase
 * - PascalCase
 * - snake_case
 * - kebab-case
 * - spaces
 */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const capitalize = (word: string) =>
  word ? word[0].toUpperCase() + word.slice(1) : word;

/** Convert text into the requested target case. */
export function convertCase(text: string, target: CaseTarget): string {
  const words = splitWords(text);

  switch (target) {
    case "camelCase":
      return words
        .map((w, i) => (i === 0 ? w : capitalize(w)))
        .join("");

    case "PascalCase":
      return words.map(capitalize).join("");

    case "snake_case":
      return words.join("_");

    case "kebab-case":
      return words.join("-");

    case "CONSTANT_CASE":
      return words.join("_").toUpperCase();

    case "Title Case":
      return words.map(capitalize).join(" ");

    case "Sentence case":
      return words.length
        ? capitalize(words[0]) +
            (words.length > 1 ? ` ${words.slice(1).join(" ")}` : "")
        : "";

    default:
      return text;
  }
}

const schema = z.object({
  text: z.string(),
  target: z.enum(VALID_TARGETS),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const result = await validateBody(request, schema);

    if (result instanceof NextResponse) {
      return result;
    }

    const { text, target } = result.data;

    return NextResponse.json({
      result: convertCase(text, target),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
}