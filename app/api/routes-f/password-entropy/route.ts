import { NextRequest, NextResponse } from "next/server";

const COMMON_WORDS = ["password", "qwerty", "admin", "letmein", "welcome"];
const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789"];

function detectCharsetSize(password: string) {
  let size = 0;
  if (/[a-z]/.test(password)) {size += 26;}
  if (/[A-Z]/.test(password)) {size += 26;}
  if (/[0-9]/.test(password)) {size += 10;}
  if (/[^A-Za-z0-9]/.test(password)) {size += 33;}
  return size;
}

function hasSequencePattern(password: string) {
  const lower = password.toLowerCase();
  return SEQUENCES.some(seq => seq.includes(lower));
}

function estimateEntropyBits(password: string) {
  const charsetSize = detectCharsetSize(password);
  if (charsetSize === 0) {return { entropyBits: 0, charsetSize: 0 };}

  let entropyBits = password.length * Math.log2(charsetSize);

  const lower = password.toLowerCase();
  if (COMMON_WORDS.some(word => lower.includes(word))) {entropyBits *= 0.55;}
  if (hasSequencePattern(password)) {entropyBits *= 0.65;}
  if (/^(.)\1+$/.test(password)) {entropyBits *= 0.4;}

  return { entropyBits: Number(entropyBits.toFixed(2)), charsetSize };
}

function toStrength(bits: number) {
  if (bits < 28) {return "very_weak";}
  if (bits < 36) {return "weak";}
  if (bits < 60) {return "medium";}
  if (bits < 80) {return "strong";}
  return "very_strong";
}

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.password !== "string") {
    return NextResponse.json(
      { error: "password must be a string" },
      { status: 400 }
    );
  }

  const { entropyBits, charsetSize } = estimateEntropyBits(body.password);
  return NextResponse.json({
    entropy_bits: entropyBits,
    charset_size: charsetSize,
    strength: toStrength(entropyBits),
  });
}
