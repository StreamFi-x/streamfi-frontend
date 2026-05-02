import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../route";

// In-memory used token store (shared via module-level import pattern)
const usedTokens = new Set<string>();

// POST /api/routes-f/captcha-math/verify
export async function POST(req: NextRequest) {
  let body: { token?: string; answer?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, answer } = body ?? {};

  if (typeof token !== "string" || token.trim() === "") {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (typeof answer !== "number") {
    return NextResponse.json({ error: "answer must be a number" }, { status: 400 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ valid: false, reason: "invalid_token" });
  }

  if (Date.now() > payload.expires_at) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  if (usedTokens.has(token)) {
    return NextResponse.json({ valid: false, reason: "already_used" });
  }

  if (payload.answer !== answer) {
    return NextResponse.json({ valid: false, reason: "wrong_answer" });
  }

  usedTokens.add(token);
  return NextResponse.json({ valid: true });
}
