import { NextRequest, NextResponse } from "next/server";
import { ISO_COUNTRY_CODES } from "./iso-countries";

/**
 * BIC / SWIFT code validator
 *
 * Format: [A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?
 *   chars 1-4  : bank code       (A-Z, 4 letters)
 *   chars 5-6  : country code    (A-Z, ISO 3166-1 alpha-2)
 *   chars 7-8  : location code   (A-Z0-9, 2 chars)
 *   chars 9-11 : branch code     (A-Z0-9, 3 chars, optional; 'XXX' = primary)
 */

const BIC_REGEX = /^([A-Z]{4})([A-Z]{2})([A-Z0-9]{2})([A-Z0-9]{3})?$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("bic" in body) ||
    typeof (body as Record<string, unknown>).bic !== "string"
  ) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const bic = (body as { bic: string }).bic;

  const match = BIC_REGEX.exec(bic);
  if (!match) {
    return NextResponse.json({ valid: false });
  }

  const [, bankCode, countryCode, locationCode, branchCode] = match;

  if (!ISO_COUNTRY_CODES.has(countryCode)) {
    return NextResponse.json(
      { valid: false, error: "unknown country code" },
      { status: 200 }
    );
  }

  return NextResponse.json({
    valid: true,
    bank_code: bankCode,
    country: countryCode,
    location_code: locationCode,
    branch: branchCode ?? null,
  });
}
