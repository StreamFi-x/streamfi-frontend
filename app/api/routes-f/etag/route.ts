import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function cleanEtag(tag: string): string {
  let t = tag.trim();
  if (t.startsWith("W/")) {
    t = t.substring(2);
  }
  if (t.startsWith('"') && t.endsWith('"')) {
    t = t.substring(1, t.length - 1);
  }
  return t;
}

export async function POST(req: NextRequest) {
  let body: { content?: unknown; weak?: unknown; if_none_match?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.content === undefined || typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content is required and must be a string." },
      { status: 400 }
    );
  }

  const isWeak = body.weak === true;
  const ifNoneMatch = body.if_none_match;

  if (ifNoneMatch !== undefined && typeof ifNoneMatch !== "string") {
    return NextResponse.json(
      { error: "if_none_match must be a string if provided." },
      { status: 400 }
    );
  }

  // Generate SHA-256 hash and truncate to 32 characters
  const hash = crypto.createHash("sha256").update(body.content).digest("hex");
  const truncatedHash = hash.substring(0, 32);

  const etag = isWeak ? `W/"${truncatedHash}"` : `"${truncatedHash}"`;

  const responseBody: { etag: string; matches?: boolean } = { etag };

  if (ifNoneMatch !== undefined) {
    let matches = false;
    const trimmedIfNoneMatch = ifNoneMatch.trim();

    if (trimmedIfNoneMatch === "*") {
      matches = true;
    } else {
      const clientTags = trimmedIfNoneMatch.split(",").map(cleanEtag);
      const generatedClean = cleanEtag(etag);
      matches = clientTags.includes(generatedClean);
    }

    responseBody.matches = matches;
  }

  return NextResponse.json(responseBody);
}
