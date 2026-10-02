import { type NextRequest, NextResponse } from "next/server";

type DedupeBody = {
  items?: unknown;
  key?: unknown;
  keep?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getByPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export async function POST(req: NextRequest) {
  let body: DedupeBody;

  try {
    body = (await req.json()) as DedupeBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { items, key, keep } = body;

  if (!Array.isArray(items)) {
    return badRequest("items must be an array.");
  }

  if (items.length > 10000) {
    return badRequest("items must not exceed 10000 elements.");
  }

  if (typeof key !== "string" || key.length === 0) {
    return badRequest("key must be a non-empty string.");
  }

  const keepMode = keep === "last" ? "last" : "first";

  const seen = new Map<unknown, number>();

  for (let i = 0; i < items.length; i++) {
    const value = getByPath(items[i], key);
    seen.set(value, i);
  }

  const result: unknown[] = [];
  const seenKeys = new Set<unknown>();

  if (keepMode === "last") {
    for (let i = items.length - 1; i >= 0; i--) {
      const value = getByPath(items[i], key);
      if (!seenKeys.has(value)) {
        seenKeys.add(value);
        result.unshift(items[i]);
      }
    }
  } else {
    for (let i = 0; i < items.length; i++) {
      const value = getByPath(items[i], key);
      if (!seenKeys.has(value)) {
        seenKeys.add(value);
        result.push(items[i]);
      }
    }
  }

  return NextResponse.json({
    items: result,
    removed_count: items.length - result.length,
  });
}
