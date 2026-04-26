import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "./_lib/helpers";
import type { JwtDecodeRequest, JwtDecodeResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: JwtDecodeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { token } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token must be a non-empty string." }, { status: 400 });
  }

  try {
    const result = decodeJwt(token);
    return NextResponse.json(result as JwtDecodeResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "JWT decoding failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
