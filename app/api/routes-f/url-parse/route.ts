import { type NextRequest, NextResponse } from "next/server";

const MAX_URL_LENGTH = 4096;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseQueryParams(search: string): Record<string, string | string[]> {
  const params = new URLSearchParams(search);
  const result: Record<string, string | string[]> = {};
  for (const key of params.keys()) {
    const values = params.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
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

  const { url } = body as Record<string, unknown>;

  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "'url' field is required and must be a string." }, { status: 400 });
  }

  if (url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters.` }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  const path_segments = parsed.pathname
    .split("/")
    .filter(Boolean);

  return NextResponse.json({
    protocol: parsed.protocol,
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    username: parsed.username,
    password: parsed.password,
    origin: parsed.origin,
    query: parseQueryParams(parsed.search),
    path_segments,
  });
}
