import { NextRequest, NextResponse } from "next/server";
import { validateDomain } from "./_lib/validate";

export async function POST(req: NextRequest) {
  let body: { domain?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body?.domain !== "string") {
    return NextResponse.json({ error: "'domain' is required and must be a string" }, { status: 400 });
  }

  const raw = body.domain.trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw) || raw.includes(":")) {
    return NextResponse.json({ error: "Invalid domain input" }, { status: 400 });
  }

  return NextResponse.json(validateDomain(raw));
}
