import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const MAX_INPUT_BYTES = 1_000_000;

export interface CharCount {
  char: string;
  count: number;
}

export interface CharFrequencyResult {
  frequencies: CharCount[];
  total: number;
}

export interface CharFrequencyOptions {
  caseSensitive?: boolean;
  ignoreWhitespace?: boolean;
  top?: number;
}

/**
 * Count character frequency in `text`, sorted by count descending (ties broken
 * by character for stable output). `total` is the number of counted characters.
 */
export function charFrequency(
  text: string,
  { caseSensitive = false, ignoreWhitespace = false, top }: CharFrequencyOptions = {},
): CharFrequencyResult {
  const normalized = caseSensitive ? text : text.toLowerCase();
  const counts = new Map<string, number>();
  let total = 0;

  for (const char of normalized) {
    if (ignoreWhitespace && /\s/.test(char)) continue;
    counts.set(char, (counts.get(char) ?? 0) + 1);
    total += 1;
  }

  let frequencies: CharCount[] = Array.from(counts, ([char, count]) => ({
    char,
    count,
  })).sort((a, b) => b.count - a.count || a.char.localeCompare(b.char));

  if (top !== undefined) {
    frequencies = frequencies.slice(0, top);
  }

  return { frequencies, total };
}

const schema = z.object({
  text: z.string().max(MAX_INPUT_BYTES, "text exceeds 1MB limit"),
  case_sensitive: z.boolean().optional(),
  ignore_whitespace: z.boolean().optional(),
  top: z.number().int().positive().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { text, case_sensitive, ignore_whitespace, top } = result.data;
  return NextResponse.json(
    charFrequency(text, {
      caseSensitive: case_sensitive,
      ignoreWhitespace: ignore_whitespace,
      top,
    }),
  );
}
