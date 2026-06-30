/**
 * GET  /api/routes-f/multi-asset-tips
 *   Returns all supported tipping assets with static USD rates and min tip amounts.
 *
 *   Response 200:
 *     { assets: [{ symbol, usd_rate, min_tip }] }
 *
 * POST /api/routes-f/multi-asset-tips
 *   Convert an amount from one asset to another.
 *
 *   Body: { amount: number, from: "XLM"|"USDC"|"BTC"|"ETH", to: "XLM"|"USDC"|"BTC"|"ETH" }
 *
 *   Response 200:
 *     { from, to, amount, converted, rate }
 *
 *   Error responses:
 *     400 — invalid body / amount ≤ 0
 *     422 — from === to (no conversion needed)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ASSETS, ASSET_MAP, convert, crossRate } from "./rates";
import type { TipAssetsResponse, ConvertResponse } from "./types";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const response: TipAssetsResponse = { assets: ASSETS };
  return NextResponse.json(response);
}

// ---------------------------------------------------------------------------
// POST — /convert logic embedded here (single route file per folder convention)
// ---------------------------------------------------------------------------

const VALID_SYMBOLS = ["XLM", "USDC", "BTC", "ETH"] as const;

const convertSchema = z.object({
  amount: z
    .number({ invalid_type_error: "amount must be a number" })
    .positive("amount must be greater than 0"),
  from: z.enum(VALID_SYMBOLS, { errorMap: () => ({ message: "from must be XLM, USDC, BTC, or ETH" }) }),
  to: z.enum(VALID_SYMBOLS, { errorMap: () => ({ message: "to must be XLM, USDC, BTC, or ETH" }) }),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { amount, from, to } = parsed.data;

  if (from === to) {
    return NextResponse.json(
      { error: "from and to must be different assets" },
      { status: 422 }
    );
  }

  // Verify both symbols exist in our catalog (they will — enum guarantees it,
  // but guard defensively for future catalog changes)
  if (!ASSET_MAP[from] || !ASSET_MAP[to]) {
    return NextResponse.json({ error: "Unsupported asset symbol" }, { status: 400 });
  }

  const converted = convert(amount, from, to);
  const rate = crossRate(from, to);

  const response: ConvertResponse = { from, to, amount, converted, rate };
  return NextResponse.json(response);
}
