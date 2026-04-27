import { NextRequest, NextResponse } from "next/server";
import { convert, roundRate, isValidCurrency } from "./_lib/helpers";
import type { CurrencyResponse } from "./_lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const amountStr = searchParams.get("amount");

  if (!from || !to || !amountStr) {
    return NextResponse.json(
      { error: "Missing required parameters: from, to, amount" },
      { status: 400 }
    );
  }

  if (!isValidCurrency(from)) {
    return NextResponse.json({ error: `Unknown currency: ${from}` }, { status: 400 });
  }

  if (!isValidCurrency(to)) {
    return NextResponse.json({ error: `Unknown currency: ${to}` }, { status: 400 });
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  try {
    const converted = convert(from, to, amount);
    const rate = roundRate(parseFloat(amountStr) > 0 ? converted / amount : 0);
    const as_of = new Date().toISOString();

    return NextResponse.json({ converted, rate, as_of } as CurrencyResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
