import { NextRequest, NextResponse } from "next/server";
import { VAT_RATES } from "./vat-rates";

type Mode = "add" | "extract";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(req: NextRequest) {
  let body: { amount?: unknown; rate?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { amount, rate, mode = "add" } = body ?? {};

  if (typeof amount !== "number" || amount < 0) {
    return NextResponse.json(
      { error: "'amount' must be a non-negative number" },
      { status: 400 },
    );
  }

  if (typeof rate !== "number" || rate < 0 || rate > 100) {
    return NextResponse.json(
      { error: "'rate' must be a number between 0 and 100" },
      { status: 400 },
    );
  }

  if (mode !== "add" && mode !== "extract") {
    return NextResponse.json(
      { error: "'mode' must be 'add' or 'extract'" },
      { status: 400 },
    );
  }

  const m = mode as Mode;
  let net: number, tax: number, gross: number;

  if (m === "add") {
    net = amount;
    tax = round2(net * (rate / 100));
    gross = round2(net + tax);
  } else {
    gross = amount;
    net = round2(gross / (1 + rate / 100));
    tax = round2(gross - net);
  }

  return NextResponse.json({ net, tax, gross, rate, mode: m });
}

export async function GET() {
  return NextResponse.json({
    description: "Reference VAT rates by country",
    rates: VAT_RATES,
  });
}
