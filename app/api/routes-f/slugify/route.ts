import { NextRequest, NextResponse } from "next/server";
import { slugify, type Separator } from "./_lib/slugify";

const VALID_SEPARATORS: Separator[] = ["-", "_"];

// POST /api/routes-f/slugify  body: { text, separator?, maxLength? }
export async function POST(req: NextRequest) {
  let body: { text?: unknown; separator?: unknown; maxLength?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text, separator, maxLength } = body ?? {};

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "'text' is required and must be a non-empty string" }, { status: 400 });
  }

  if (separator !== undefined && !VALID_SEPARATORS.includes(separator as Separator)) {
    return NextResponse.json(
      { error: `'separator' must be one of: ${VALID_SEPARATORS.map((s) => `'${s}'`).join(", ")}` },
      { status: 400 },
    );
  }

  if (maxLength !== undefined) {
    const ml = Number(maxLength);
    if (!Number.isInteger(ml) || ml < 1) {
      return NextResponse.json({ error: "'maxLength' must be a positive integer" }, { status: 400 });
    }
  }

  const slug = slugify(text, {
    separator: separator as Separator | undefined,
    maxLength: maxLength !== undefined ? Number(maxLength) : undefined,
  });

  return NextResponse.json({ slug });
}
