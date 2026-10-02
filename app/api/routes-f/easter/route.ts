import { NextRequest, NextResponse } from 'next/server';

function computeEaster(year: number): { easter: string; good_friday: string; easter_monday: string } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easterDate = new Date(year, month - 1, day);
  const easterString = easterDate.toISOString().split('T')[0];

  const goodFridayDate = new Date(easterDate);
  goodFridayDate.setDate(goodFridayDate.getDate() - 2);
  const goodFridayString = goodFridayDate.toISOString().split('T')[0];

  const easterMondayDate = new Date(easterDate);
  easterMondayDate.setDate(easterMondayDate.getDate() + 1);
  const easterMondayString = easterMondayDate.toISOString().split('T')[0];

  return {
    easter: easterString,
    good_friday: goodFridayString,
    easter_monday: easterMondayString,
  };
}

export async function GET(req: NextRequest) {
  const year = parseInt(new URL(req.url).searchParams.get('year') || '', 10);

  if (isNaN(year)) {
    return NextResponse.json({ error: 'year query param is required' }, { status: 400 });
  }

  if (year < 1583 || year > 4099) {
    return NextResponse.json(
      { error: 'year must be in range [1583, 4099]' },
      { status: 400 }
    );
  }

  const result = computeEaster(year);
  return NextResponse.json(result);
}
