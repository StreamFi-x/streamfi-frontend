import { NextRequest, NextResponse } from "next/server";

const MAX_URL_LENGTH = 4096;

function parseQueryToObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  });

  return result;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawUrl = body.url;

  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return NextResponse.json({ error: "url must be a non-empty string." }, { status: 400 });
  }

  if (rawUrl.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      { error: `url must not exceed ${MAX_URL_LENGTH} characters.` },
      { status: 400 }
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  const pathSegments = parsed.pathname
    .split("/")
    .filter((seg) => seg.length > 0);

  const query = parseQueryToObject(parsed.searchParams);

  return NextResponse.json({
    protocol: parsed.protocol,
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port || "",
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    query,
    path_segments: pathSegments,
    origin: parsed.origin,
  });
}
