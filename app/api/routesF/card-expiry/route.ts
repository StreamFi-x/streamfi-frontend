import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month, year, now } = body;

    if (typeof month !== 'number' || month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be between 1 and 12' }, { status: 400 });
    }

    if (typeof year !== 'number') {
      return NextResponse.json({ error: 'year is required' }, { status: 400 });
    }

    let fullYear = year;
    if (year < 100) {
      fullYear = year + 2000;
    }

    const nowDate = now ? new Date(now) : new Date();
    const currentYear = nowDate.getFullYear();
    const currentMonth = nowDate.getMonth() + 1;

    const expiryDate = new Date(fullYear, month, 0);
    expiryDate.setHours(23, 59, 59, 999);

    const isExpired = expiryDate < nowDate;

    let monthsUntilExpiry = 0;
    if (!isExpired) {
      monthsUntilExpiry =
        (fullYear - currentYear) * 12 + (month - currentMonth);
    }

    return NextResponse.json({
      valid: !isExpired,
      expired: isExpired,
      months_until_expiry: Math.max(0, monthsUntilExpiry),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
