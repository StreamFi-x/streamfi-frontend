import { type NextRequest, NextResponse } from "next/server";

type ArrayFormat = "repeat" | "bracket" | "comma";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseQueryString(input: string): Record<string, unknown> {
  const qs = input.startsWith("?") ? input.slice(1) : input;
  const result: Record<string, unknown> = {};

  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
    const rawVal = eqIdx >= 0 ? pair.slice(eqIdx + 1) : "";
    const key = decodeURIComponent(rawKey);
    const val = decodeURIComponent(rawVal);

    // Bracket notation for nested objects: user[name]=john
    const bracketMatch = key.match(/^([^\[]+)\[([^\]]*)\]$/);
    if (bracketMatch) {
      const parent = bracketMatch[1];
      const child = bracketMatch[2];
      if (!isRecord(result[parent])) result[parent] = {};
      (result[parent] as Record<string, string>)[child] = val;
      continue;
    }

    if (key in result) {
      const existing = result[key];
      result[key] = Array.isArray(existing) ? [...existing, val] : [existing, val];
    } else {
      result[key] = val;
    }
  }

  return result;
}

function buildQueryString(
  input: Record<string, unknown>,
  options: { array_format?: ArrayFormat } = {}
): string {
  const { array_format = "repeat" } = options;
  const parts: string[] = [];

    // Brackets are kept literal (not percent-encoded) to match conventional qs behaviour
  function encodeVal(v: unknown): string {
    return encodeURIComponent(String(v));
  }

  function encode(k: string, v: unknown, prefix = ""): void {
    // Build key with literal brackets; only encode the leaf segment names
    const fullKey = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      if (array_format === "comma") {
        parts.push(`${fullKey}=${v.map(encodeVal).join(",")}`);
      } else if (array_format === "bracket") {
        v.forEach((item) => parts.push(`${fullKey}[]=${encodeVal(item)}`));
      } else {
        v.forEach((item) => parts.push(`${fullKey}=${encodeVal(item)}`));
      }
    } else if (isRecord(v)) {
      for (const [ck, cv] of Object.entries(v)) {
        encode(ck, cv, fullKey);
      }
    } else {
      parts.push(`${fullKey}=${encodeVal(v)}`);
    }
  }

  for (const [k, v] of Object.entries(input)) {
    encode(k, v);
  }

  return parts.join("&");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { mode, input, options } = body as Record<string, unknown>;

  if (mode !== "parse" && mode !== "build") {
    return NextResponse.json({ error: "mode must be 'parse' or 'build'." }, { status: 400 });
  }

  if (mode === "parse") {
    if (typeof input !== "string") {
      return NextResponse.json({ error: "input must be a string in parse mode." }, { status: 400 });
    }
    return NextResponse.json({ result: parseQueryString(input) });
  }

  // build mode
  if (!isRecord(input)) {
    return NextResponse.json({ error: "input must be an object in build mode." }, { status: 400 });
  }

  const opts = isRecord(options) ? options : {};
  return NextResponse.json({ result: buildQueryString(input, opts as { array_format?: ArrayFormat }) });
}
