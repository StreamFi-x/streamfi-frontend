import { NextRequest, NextResponse } from "next/server";
import { numberToRoman, romanToNumber } from "./_lib/helpers";
import type { RomanToNumberResponse, NumberToRomanResponse } from "./_lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const toRoman = searchParams.get('to_roman');
  const toNumber = searchParams.get('to_number');

  try {
    if (toRoman !== null) {
      const num = parseInt(toRoman, 10);
      if (isNaN(num)) {
        return NextResponse.json({ error: "Invalid number parameter." }, { status: 400 });
      }
      
      const roman = numberToRoman(num);
      return NextResponse.json({ roman } as NumberToRomanResponse);
    }

    if (toNumber !== null) {
      const roman = toNumber.trim();
      if (!roman) {
        return NextResponse.json({ error: "Roman numeral parameter required." }, { status: 400 });
      }
      
      const num = romanToNumber(roman);
      return NextResponse.json({ number: num } as RomanToNumberResponse);
    }

    return NextResponse.json({ error: "Either to_roman or to_number parameter required." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
