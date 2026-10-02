import { type NextRequest, NextResponse } from "next/server";
import { convertUnixDate } from "./_lib/convert";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(convertUnixDate(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert date.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
