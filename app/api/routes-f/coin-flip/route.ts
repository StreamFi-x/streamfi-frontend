import type { NextRequest } from "next/server";
import { coinFlip } from "./_lib/coinFlip";

const DEFAULT_COUNT = 1;
const MAX_COUNT = 1000;
const DEFAULT_BIAS = 0.5;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: { count?: unknown; seed?: unknown; bias?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const count = body?.count === undefined ? DEFAULT_COUNT : Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return jsonResponse({ error: `'count' must be an integer between 1 and ${MAX_COUNT}` }, 400);
  }

  const bias = body?.bias === undefined ? DEFAULT_BIAS : Number(body.bias);
  if (typeof bias !== "number" || Number.isNaN(bias) || bias < 0 || bias > 1) {
    return jsonResponse({ error: "'bias' must be a number between 0 and 1" }, 400);
  }

  const seed = body?.seed === undefined ? undefined : Number(body.seed);
  if (body?.seed !== undefined && (typeof seed !== "number" || Number.isNaN(seed))) {
    return jsonResponse({ error: "'seed' must be a numeric value" }, 400);
  }

  const result = coinFlip(count, bias, seed);
  return jsonResponse(result);
}
