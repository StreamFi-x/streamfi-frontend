import { NextRequest, NextResponse } from 'next/server';
import { PhoneValidationRequest, PhoneValidationResponse } from './_lib/types';
import { sanitizePhone, validatePhone } from './_lib/helpers';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: PhoneValidationRequest = await request.json();

    // validating phone field
    if (typeof body.phone !== 'string' || body.phone.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid "phone" field' },
        { status: 400 }
      );
    }

    // validating default_country if provided
    if (body.default_country !== undefined && typeof body.default_country !== 'string') {
      return NextResponse.json(
        { error: 'Invalid "default_country" — must be a string (ISO 3166-1 alpha-2)' },
        { status: 400 }
      );
    }

    // sanitizing - strip spaces, dashes, parens, dots, leading zeros
    const cleanPhone = sanitizePhone(body.phone);

    // validate
    const result = validatePhone(cleanPhone, body.default_country?.toUpperCase());

    // checking if validation returned an error
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result as PhoneValidationResponse, { status: 200 });
  } catch (error) {
    console.error('[phone-validate] Validation error occurred');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}