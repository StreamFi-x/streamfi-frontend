import { NextRequest, NextResponse } from "next/server";
import { parseXml } from "./parser";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: "Input exceeds 5 MB limit" }, { status: 413 });
  }

  let body: { xml?: unknown; attribute_prefix?: unknown; text_key?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { xml, attribute_prefix = "@", text_key = "#text" } = body ?? {};

  if (typeof xml !== "string" || xml.trim() === "") {
    return NextResponse.json(
      { error: "'xml' is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  if (Buffer.byteLength(xml, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Input exceeds 5 MB limit" }, { status: 413 });
  }

  if (typeof attribute_prefix !== "string") {
    return NextResponse.json({ error: "'attribute_prefix' must be a string" }, { status: 400 });
  }
  if (typeof text_key !== "string") {
    return NextResponse.json({ error: "'text_key' must be a string" }, { status: 400 });
  }

  try {
    const { json, root_element } = parseXml(xml, {
      attributePrefix: attribute_prefix,
      textKey: text_key,
    });
    return NextResponse.json({ json, root_element });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to parse XML";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
