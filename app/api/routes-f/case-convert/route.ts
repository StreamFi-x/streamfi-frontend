import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export type CaseTarget = "snake" | "camel" | "pascal" | "kebab";

/**
 * Split an identifier into lowercase words, auto-detecting the source case
 * (snake_case, kebab-case, camelCase, PascalCase). Embedded numbers are kept
 * attached to their adjacent word.
 */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camel/Pascal boundary
    .replace(/[_-]+/g, " ") // snake / kebab separators
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

/** Convert an identifier between snake / camel / pascal / kebab case. */
export function convertCase(text: string, target: CaseTarget): string {
  const words = splitWords(text);
  switch (target) {
    case "snake":
      return words.join("_");
    case "kebab":
      return words.join("-");
    case "camel":
      return words.map((w, i) => (i === 0 ? w : cap(w))).join("");
    case "pascal":
      return words.map(cap).join("");
  }
}

const schema = z.object({
  text: z.string(),
  target: z.enum(["snake", "camel", "pascal", "kebab"]),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { text, target } = result.data;
  return NextResponse.json({ result: convertCase(text, target) });
}
