import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {return obj.map(sortKeys);}
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((obj as Record<string, unknown>)[k])])
    );
  }
  return obj;
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: "Input exceeds 5MB limit" }, { status: 413 });
  }

  let body: { input?: unknown; mode?: unknown; indent?: unknown; sort_keys?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { input, mode, indent = 2, sort_keys = false } = body;

  if (typeof input !== "string") {
    return NextResponse.json({ valid: false, error: "input must be a string" }, { status: 400 });
  }
  if (mode !== "minify" && mode !== "prettify") {
    return NextResponse.json({ error: "mode must be minify or prettify" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return NextResponse.json({ valid: false, error: (e as Error).message });
  }

  const data = sort_keys ? sortKeys(parsed) : parsed;
  const output =
    mode === "minify"
      ? JSON.stringify(data)
      : JSON.stringify(data, null, typeof indent === "number" ? indent : 2);

  return NextResponse.json({ output });
}
