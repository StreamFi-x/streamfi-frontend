import { NextRequest, NextResponse } from "next/server";
import { validateIp } from "./_lib/ip";

type RequestBody = {
  ip?: unknown;
};

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json(validateIp(body.ip));
}
