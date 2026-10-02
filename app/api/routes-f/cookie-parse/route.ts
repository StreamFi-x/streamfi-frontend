import { type NextRequest, NextResponse } from "next/server";
import { buildCookie, parseCookies } from "./_lib/helpers";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
    }

    const { mode, input } = body as Record<string, unknown>;

    if (mode === "parse") {
      return NextResponse.json(parseCookies(input));
    }

    if (mode === "build") {
      return NextResponse.json(buildCookie(input));
    }

    return NextResponse.json({ error: "mode must be parse or build." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process cookie.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
