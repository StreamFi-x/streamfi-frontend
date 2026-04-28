import { NextRequest, NextResponse } from "next/server";

const MAX_INPUT_SIZE = 1024 * 1024;

type UrlEncodeBody = {
  input?: unknown;
  mode?: unknown;
  level?: unknown;
};

export async function POST(req: NextRequest) {
  let body: UrlEncodeBody;
  try {
    body = (await req.json()) as UrlEncodeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = body.input;
  const mode = body.mode;
  const level = body.level ?? "component";

  if (typeof input !== "string") {
    return NextResponse.json({ error: "input must be a string." }, { status: 400 });
  }

  if (Buffer.byteLength(input, "utf8") > MAX_INPUT_SIZE) {
    return NextResponse.json({ error: "Input too large. Maximum size is 1MB." }, { status: 413 });
  }

  if (mode !== "encode" && mode !== "decode") {
    return NextResponse.json({ error: "mode must be 'encode' or 'decode'." }, { status: 400 });
  }

  if (level !== "component" && level !== "full") {
    return NextResponse.json({ error: "level must be 'component' or 'full'." }, { status: 400 });
  }

  try {
    const output =
      mode === "encode"
        ? level === "full"
          ? encodeURI(input)
          : encodeURIComponent(input)
        : level === "full"
          ? decodeURI(input)
          : decodeURIComponent(input);

    return NextResponse.json({ output });
  } catch (error) {
    if (error instanceof URIError) {
      return NextResponse.json(
        { error: "Malformed percent-encoded sequence in input." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
