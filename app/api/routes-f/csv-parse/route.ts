import { NextResponse } from "next/server";
import { buildCsvResult } from "./_lib/parser";

const TEN_MB = 10 * 1024 * 1024;

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as { csv?: unknown; has_header?: unknown; delimiter?: unknown };
  const csv = payload.csv;
  const hasHeader = payload.has_header ?? true;
  const delimiter = payload.delimiter ?? ",";

  if (typeof csv !== "string") {
    return NextResponse.json({ error: "csv must be a string" }, { status: 400 });
  }

  if (Buffer.byteLength(csv, "utf8") > TEN_MB) {
    return NextResponse.json({ error: "CSV input exceeds 10MB limit" }, { status: 400 });
  }

  if (typeof hasHeader !== "boolean") {
    return NextResponse.json({ error: "has_header must be a boolean" }, { status: 400 });
  }

  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    return NextResponse.json({ error: "delimiter must be a single character" }, { status: 400 });
  }

  try {
    const result = buildCsvResult(csv, hasHeader, delimiter);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse CSV";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
