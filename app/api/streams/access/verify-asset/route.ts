/**
 * GET /api/streams/access/verify-asset?code=STREAM&issuer=GABC...
 *
 * Utility endpoint used by the dashboard "Verify asset" button.
 * Checks Stellar Horizon to confirm the asset has been issued
 * (has at least one trustline).
 *
 * No authentication required — read-only public Horizon data.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAssetExists, isValidAssetCode, isValidStellarIssuer } from "@/lib/stream/access";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim() ?? "";
  const issuer = searchParams.get("issuer")?.trim() ?? "";

  if (!code || !issuer) {
    return NextResponse.json(
      { error: "code and issuer query params are required" },
      { status: 400 }
    );
  }

  if (!isValidAssetCode(code)) {
    return NextResponse.json(
      { error: "Invalid asset code. Must be 1–12 alphanumeric characters." },
      { status: 400 }
    );
  }

  if (!isValidStellarIssuer(issuer)) {
    return NextResponse.json(
      { error: "Invalid issuer address. Must be a valid Stellar public key." },
      { status: 400 }
    );
  }

  const exists = await verifyAssetExists(code, issuer);

  return NextResponse.json(
    { exists },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}
