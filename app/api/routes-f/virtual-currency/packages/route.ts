import { NextResponse } from "next/server";
import { BITS_PACKAGES } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/virtual-currency/packages
 * List available StreamBits packages and exchange rates.
 */
export async function GET() {
  return NextResponse.json({
    packages: BITS_PACKAGES,
    currency: "USD/XLM",
    info: "100 StreamBits equates to $1.00 creator value",
  });
}
