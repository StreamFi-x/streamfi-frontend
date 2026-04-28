import { NextRequest, NextResponse } from "next/server";
import { generateHoroscope } from "./_lib/helpers";
import type { HoroscopeResponse } from "./_lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sign = searchParams.get('sign');
  const date = searchParams.get('date');

  try {
    if (!sign || !date) {
      return NextResponse.json({ 
        error: "Both 'sign' and 'date' query parameters are required." 
      }, { status: 400 });
    }

    const horoscope = generateHoroscope(sign, date);
    return NextResponse.json(horoscope as HoroscopeResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Horoscope generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
