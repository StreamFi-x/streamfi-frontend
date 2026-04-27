import { NextRequest, NextResponse } from "next/server";
import { formatTimeAgo } from "./_lib/formatter";
import type { TimeAgoRequest, TimeStyle } from "./_lib/types";

const VALID_STYLES: TimeStyle[] = ["long", "short", "narrow"];

export async function POST(req: NextRequest) {
  let body: TimeAgoRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { timestamp, now, style = "long", locale = "en-US" } = body;

  if (timestamp === undefined || timestamp === null) {
    return NextResponse.json({ error: "timestamp is required." }, { status: 400 });
  }
  if (typeof timestamp !== "number" && typeof timestamp !== "string") {
    return NextResponse.json({ error: "timestamp must be a number or ISO string." }, { status: 400 });
  }
  if (!VALID_STYLES.includes(style)) {
    return NextResponse.json(
      { error: `style must be one of: ${VALID_STYLES.join(", ")}.` },
      { status: 400 }
    );
  }
  if (typeof locale !== "string") {
    return NextResponse.json({ error: "locale must be a string." }, { status: 400 });
  }

  let result;
  try {
    result = formatTimeAgo(timestamp, now, style, locale);
  } catch {
    return NextResponse.json({ error: "Invalid timestamp or locale." }, { status: 400 });
  }

  return NextResponse.json(result);
}
