import { NextRequest, NextResponse } from "next/server";

type ArrayFormat = "bracket" | "comma" | "repeat";

function parseQueryString(input: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const str = input.startsWith("?") ? input.slice(1) : input;

  if (str.length === 0) return result;

  const pairs = str.split("&");

  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    const rawKey = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
    const rawValue = eqIdx === -1 ? "" : pair.slice(eqIdx + 1);

    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue);

    // Handle bracket notation: a[b]=c
    const bracketMatch = key.match(/^([^[]+)\[([^\]]*)\]$/);

    if (bracketMatch) {
      const parentKey = bracketMatch[1];
      const childKey = bracketMatch[2];

      if (!result[parentKey] || typeof result[parentKey] !== "object" || Array.isArray(result[parentKey])) {
        result[parentKey] = {};
      }

      (result[parentKey] as Record<string, unknown>)[childKey] = value;
    } else {
      // Handle repeated keys -> arrays
      const existing = result[key];
      if (existing === undefined) {
        result[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing as string, value];
      }
    }
  }

  return result;
}

function buildQueryString(
  input: Record<string, unknown>,
  arrayFormat: ArrayFormat
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      switch (arrayFormat) {
        case "bracket":
          for (const item of value) {
            parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(item))}`);
          }
          break;
        case "comma":
          parts.push(
            `${encodeURIComponent(key)}=${value.map((v) => encodeURIComponent(String(v))).join(",")}`
          );
          break;
        case "repeat":
        default:
          for (const item of value) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
          }
          break;
      }
    } else if (typeof value === "object") {
      // Nested objects via bracket notation
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        if (childValue !== null && childValue !== undefined) {
          parts.push(
            `${encodeURIComponent(key)}[${encodeURIComponent(childKey)}]=${encodeURIComponent(String(childValue))}`
          );
        }
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.join("&");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode = body.mode as string;

  if (mode !== "parse" && mode !== "build") {
    return NextResponse.json(
      { error: "mode must be 'parse' or 'build'." },
      { status: 400 }
    );
  }

  const options = (body.options || {}) as Record<string, unknown>;
  const arrayFormat = (options.array_format as ArrayFormat) || "repeat";

  if (!["bracket", "comma", "repeat"].includes(arrayFormat)) {
    return NextResponse.json(
      { error: "options.array_format must be 'bracket', 'comma', or 'repeat'." },
      { status: 400 }
    );
  }

  if (mode === "parse") {
    const input = body.input;
    if (typeof input !== "string") {
      return NextResponse.json(
        { error: "input must be a string when mode is 'parse'." },
        { status: 400 }
      );
    }

    const parsed = parseQueryString(input);
    return NextResponse.json({ result: parsed });
  }

  // mode === "build"
  const input = body.input;
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return NextResponse.json(
      { error: "input must be an object when mode is 'build'." },
      { status: 400 }
    );
  }

  const queryString = buildQueryString(input as Record<string, unknown>, arrayFormat);
  return NextResponse.json({ result: queryString });
}
