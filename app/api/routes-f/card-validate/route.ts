import { NextRequest, NextResponse } from 'next/server';
import { CardValidationRequest, CardValidationResponse } from './_lib/types';
import { sanitizeCardNumber, detectBrand, luhnCheck, getLast4 } from './_lib/helpers';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: CardValidationRequest = await request.json();

    if (typeof body.number !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "number" field' },
        { status: 400 }
      );
    }

    // sanitize- strip spaces and dashes
    const cleanNumber = sanitizeCardNumber(body.number);

    // validatedation - must be digits only after sanitization
    if (!/^\d+$/.test(cleanNumber)) {
      return NextResponse.json(
        { error: 'Card number must contain only digits, spaces, or dashes' },
        { status: 400 }
      );
    }

    // reject if > 19 digits
    if (cleanNumber.length > 19) {
      return NextResponse.json(
        { error: 'Card number exceeds maximum length of 19 digits' },
        { status: 400 }
      );
    }

    // brand detection from IIN prefix
    const brand = detectBrand(cleanNumber);

    // eun Luhn algorithm
    const valid = luhnCheck(cleanNumber);

    // extract last 4 — never log or return full PAN
    const last4 = getLast4(cleanNumber);

    const response: CardValidationResponse = {
      valid,
      brand,
      last4,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // never log full card numbers — only generic error
    console.error('[card-validate] Validation error occurred');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}