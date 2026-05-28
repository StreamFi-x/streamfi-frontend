import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ssn } = body;

    if (typeof ssn !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid ssn' }, { status: 400 });
    }

    // Strip formatting — accept dashes or plain digits
    const digits = ssn.replace(/-/g, '');

    if (!/^\d{9}$/.test(digits)) {
      return NextResponse.json({ valid: false, reason: 'SSN must be exactly 9 digits' });
    }

    const area   = parseInt(digits.slice(0, 3), 10);
    const group  = parseInt(digits.slice(3, 5), 10);
    const serial = parseInt(digits.slice(5, 9), 10);

    if (area === 0) {
      return NextResponse.json({ valid: false, reason: 'Area number cannot be 000' });
    }
    if (area === 666) {
      return NextResponse.json({ valid: false, reason: 'Area number 666 is not assigned' });
    }
    if (area >= 900) {
      return NextResponse.json({ valid: false, reason: 'Area numbers 900–999 are not assigned' });
    }
    if (group === 0) {
      return NextResponse.json({ valid: false, reason: 'Group number cannot be 00' });
    }
    if (serial === 0) {
      return NextResponse.json({ valid: false, reason: 'Serial number cannot be 0000' });
    }

    const normalized = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    return NextResponse.json({ valid: true, normalized });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
