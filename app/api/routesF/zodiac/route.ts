import { NextResponse } from 'next/server';

const zodiacSigns = [
  { sign: 'Capricorn', element: 'Earth', date_range: 'Dec 22 - Jan 19', start: { m: 12, d: 22 }, end: { m: 1, d: 19 } },
  { sign: 'Aquarius', element: 'Air', date_range: 'Jan 20 - Feb 18', start: { m: 1, d: 20 }, end: { m: 2, d: 18 } },
  { sign: 'Pisces', element: 'Water', date_range: 'Feb 19 - Mar 20', start: { m: 2, d: 19 }, end: { m: 3, d: 20 } },
  { sign: 'Aries', element: 'Fire', date_range: 'Mar 21 - Apr 19', start: { m: 3, d: 21 }, end: { m: 4, d: 19 } },
  { sign: 'Taurus', element: 'Earth', date_range: 'Apr 20 - May 20', start: { m: 4, d: 20 }, end: { m: 5, d: 20 } },
  { sign: 'Gemini', element: 'Air', date_range: 'May 21 - Jun 20', start: { m: 5, d: 21 }, end: { m: 6, d: 20 } },
  { sign: 'Cancer', element: 'Water', date_range: 'Jun 21 - Jul 22', start: { m: 6, d: 21 }, end: { m: 7, d: 22 } },
  { sign: 'Leo', element: 'Fire', date_range: 'Jul 23 - Aug 22', start: { m: 7, d: 23 }, end: { m: 8, d: 22 } },
  { sign: 'Virgo', element: 'Earth', date_range: 'Aug 23 - Sep 22', start: { m: 8, d: 23 }, end: { m: 9, d: 22 } },
  { sign: 'Libra', element: 'Air', date_range: 'Sep 23 - Oct 22', start: { m: 9, d: 23 }, end: { m: 10, d: 22 } },
  { sign: 'Scorpio', element: 'Water', date_range: 'Oct 23 - Nov 21', start: { m: 10, d: 23 }, end: { m: 11, d: 21 } },
  { sign: 'Sagittarius', element: 'Fire', date_range: 'Nov 22 - Dec 21', start: { m: 11, d: 22 }, end: { m: 12, d: 21 } }
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  if (!dateStr) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
  }

  const dateRegex = /^\\d{4}-(\\d{2})-(\\d{2})$/;
  const match = dateStr.match(dateRegex);

  if (!match) {
    return NextResponse.json({ error: 'Invalid date format, use YYYY-MM-DD' }, { status: 400 });
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  let foundSign = zodiacSigns.find(z => {
    if (z.start.m === z.end.m) {
      return month === z.start.m && day >= z.start.d && day <= z.end.d;
    } else {
      return (month === z.start.m && day >= z.start.d) || (month === z.end.m && day <= z.end.d);
    }
  });

  if (!foundSign) {
    // Fallback for valid dates but out of bounds (though handled above)
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  return NextResponse.json({
    sign: foundSign.sign,
    element: foundSign.element,
    date_range: foundSign.date_range
  });
}
