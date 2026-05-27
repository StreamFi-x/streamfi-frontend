import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

/**
 * Extract uppercased initials from a full name. Whitespace and hyphens both
 * separate name parts (so "Mary-Jane" contributes M and J), capped at `max`.
 */
export function extractInitials(name: string, max = 2): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .flatMap((w) => w.split("-"))
    .filter(Boolean);
  return parts
    .map((p) => p[0].toUpperCase())
    .slice(0, max)
    .join("");
}

const schema = z.object({
  name: z.string(),
  max: z.number().int().positive().optional().default(2),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { name, max } = result.data;
  return NextResponse.json({ initials: extractInitials(name, max) });
}
