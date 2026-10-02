import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type ExchangePreviewResponse = {
  fiat_estimate: number;
  rate_used: number;
};

const bodySchema = z.object({
  asset: z.enum(["XLM", "USDC"]),
  amount: z.number().positive().finite(),
  fiat_currency: z.enum(["USD", "EUR", "NGN"]),
});

// Static exchange rates bundled inside the folder (scope constraint).
// rate_used is the direct asset -> fiat rate applied to the tip amount.
const RATES: Record<"XLM" | "USDC", Record<"USD" | "EUR" | "NGN", number>> = {
  XLM: {
    USD: 0.12,
    EUR: 0.11,
    NGN: 186.0,
  },
  USDC: {
    USD: 1.0,
    EUR: 0.92,
    NGN: 1550.0,
  },
};

// Fiat currencies display two decimal places; keep the estimate consistent
// with what the viewer would actually be charged.
function roundFiat(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ExchangePreviewResponse | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = bodySchema.safeParse(raw);
  if (!validation.success) {
    return NextResponse.json(
      { error: "asset (XLM|USDC), positive amount and fiat_currency (USD|EUR|NGN) are required" },
      { status: 400 }
    );
  }

  const { asset, amount, fiat_currency } = validation.data;

  const rate_used = RATES[asset][fiat_currency];
  const fiat_estimate = roundFiat(amount * rate_used);

  return NextResponse.json({ fiat_estimate, rate_used });
}
