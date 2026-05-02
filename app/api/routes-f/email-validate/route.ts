import { NextRequest, NextResponse } from "next/server";
import { validateEmail } from "./_lib/helpers";

// POST /api/routes-f/email-validate body: { email: string }
export async function POST(req: NextRequest) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body?.email !== "string") {
    return NextResponse.json({ error: "'email' is required and must be a string" }, { status: 400 });
  }

  const result = validateEmail(body.email);
  return NextResponse.json(result);
}
