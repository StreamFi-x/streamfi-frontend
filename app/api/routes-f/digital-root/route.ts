import { NextRequest, NextResponse } from "next/server";

function sumDigits(value: string): number {
  return value.split("").reduce((sum, digit) => sum + Number(digit), 0);
}

function getPersistence(value: string): number {
  let current = value;
  let steps = 0;

  while (current.length > 1) {
    current = String(sumDigits(current));
    steps += 1;
  }

  return steps;
}

function getDigitalRoot(value: string): number {
  if (value === "0") {
    return 0;
  }

  const numericValue = Number(value);
  return 1 + ((numericValue - 1) % 9);
}

export async function GET(req: NextRequest) {
  const n = new URL(req.url).searchParams.get("n");

  if (!n || !/^\d+$/.test(n)) {
    return NextResponse.json(
      { error: "n must be a non-negative integer" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    digital_root: getDigitalRoot(n),
    persistence: getPersistence(n),
  });
}
