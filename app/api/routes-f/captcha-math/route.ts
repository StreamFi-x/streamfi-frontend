import { NextResponse } from "next/server";
import { createHmac, randomInt } from "crypto";

const SECRET = "captcha-math-dev-secret-streamfi";
const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

type Operation = "+" | "-" | "*";

function generateChallenge(): { question: string; answer: number } {
  const ops: Operation[] = ["+", "-", "*"];
  const op = ops[randomInt(0, 3)];
  const a = randomInt(1, 31);
  const b = randomInt(1, 31);

  let answer: number;
  switch (op) {
    case "+":
      answer = a + b;
      break;
    case "-":
      answer = a - b;
      break;
    case "*":
      answer = a * b;
      break;
  }

  return { question: `What is ${a} ${op} ${b}?`, answer };
}

function signToken(payload: object): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): { answer: number; expires_at: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [encoded, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  if (sig !== expected) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// GET /api/routes-f/captcha-math
export async function GET() {
  const { question, answer } = generateChallenge();
  const payload = { answer, expires_at: Date.now() + EXPIRY_MS };
  const token = signToken(payload);
  return NextResponse.json({ challenge: question, token });
}
