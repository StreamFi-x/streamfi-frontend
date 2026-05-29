import { NextRequest, NextResponse } from "next/server";

const SMALL = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const SCALE = ["", "thousand", "million", "billion", "trillion", "quadrillion"];
const MAX_ABS = BigInt("1000000000000000");

function belowThousandToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;

  if (hundreds > 0) {
    parts.push(`${SMALL[hundreds]} hundred`);
  }

  if (rem > 0) {
    if (rem < 20) {
      parts.push(SMALL[rem]);
    } else {
      const t = Math.floor(rem / 10);
      const u = rem % 10;
      parts.push(u > 0 ? `${TENS[t]}-${SMALL[u]}` : TENS[t]);
    }
  }

  return parts.join(" ");
}

export function integerToWords(value: bigint): string {
  if (value === BigInt(0)) {
    return "zero";
  }

  const negative = value < BigInt(0);
  let n = negative ? -value : value;
  const chunks: string[] = [];
  let scaleIndex = 0;

  while (n > BigInt(0)) {
    const chunk = Number(n % BigInt(1000));
    if (chunk > 0) {
      const words = belowThousandToWords(chunk);
      const scale = SCALE[scaleIndex];
      chunks.push(scale ? `${words} ${scale}` : words);
    }
    n /= BigInt(1000);
    scaleIndex += 1;
  }

  const words = chunks.reverse().join(" ");
  return negative ? `minus ${words}` : words;
}

function parseInteger(input: string): bigint | null {
  if (!/^-?\d+$/.test(input.trim())) {
    return null;
  }
  try {
    return BigInt(input.trim());
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const nParam = req.nextUrl.searchParams.get("n");
  if (!nParam) {
    return NextResponse.json(
      { error: "n query parameter is required." },
      { status: 400 }
    );
  }

  const parsed = parseInteger(nParam);
  if (parsed === null) {
    return NextResponse.json(
      { error: "n must be an integer string." },
      { status: 400 }
    );
  }

  if (parsed <= -MAX_ABS || parsed >= MAX_ABS) {
    return NextResponse.json(
      { error: "n must satisfy |n| < 10^15." },
      { status: 400 }
    );
  }

  return NextResponse.json({ words: integerToWords(parsed) });
}
