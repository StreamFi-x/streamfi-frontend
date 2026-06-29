import { NextRequest, NextResponse } from "next/server";
import { SUPPORTED_CURRENCIES } from "./denominations";
import { breakdownAmount } from "./helpers";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { amount, currency = "USD" } = body as { amount?: unknown; currency?: unknown };

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: "amount must be a non-negative finite number" },
      { status: 400 }
    );
  }

  if (typeof currency !== "string" || !SUPPORTED_CURRENCIES.includes(currency.toUpperCase())) {
    return NextResponse.json(
      { error: `currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Round to cent precision
  const roundedAmount = Math.round(amount * 100) / 100;
  const result = breakdownAmount(roundedAmount, currency.toUpperCase());

  return NextResponse.json(result, { status: 200 });
}
