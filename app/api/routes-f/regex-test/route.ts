import { NextResponse } from "next/server";
import { testRegex } from "./_lib/regex";
import { RegexTestRequest } from "./types";

const ALLOWED_FLAGS = new Set(["g", "i", "m", "s", "u", "y"]);

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as Partial<RegexTestRequest>;

  const { pattern, flags, input } = payload;

  if (typeof pattern !== "string" || typeof input !== "string") {
    return NextResponse.json(
      { error: "pattern and input must be strings" },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(input, "utf8") > 100 * 1024) {
    return NextResponse.json(
      { error: "input exceeds 100KB limit" },
      { status: 400 }
    );
  }

  if (flags !== undefined && typeof flags !== "string") {
    return NextResponse.json(
      { error: "flags must be a string" },
      { status: 400 }
    );
  }

  if (flags) {
    for (const flag of flags) {
      if (!ALLOWED_FLAGS.has(flag)) {
        return NextResponse.json(
          { error: `invalid flag: ${flag}` },
          { status: 400 }
        );
      }
    }
  }

  try {
    const result = testRegex(pattern, flags || "", input);
    return NextResponse.json({
      valid: result.valid,
      matches: result.matches,
      total: result.matches.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test regex";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
