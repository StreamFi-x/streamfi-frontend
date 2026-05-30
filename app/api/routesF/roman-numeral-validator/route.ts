import { NextResponse } from 'next/server';

type RomanValidationResult = {
  valid: boolean;
  value?: number;
  reason?: string;
};

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

const ROMAN_CHARACTERS = /^[IVXLCDM]+$/;
const STRICT_ROMAN_NUMERAL =
  /^(?=.)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

function romanToNumber(roman: string): number {
  let total = 0;

  for (let index = 0; index < roman.length; index++) {
    const current = ROMAN_VALUES[roman[index]];
    const next = ROMAN_VALUES[roman[index + 1]] ?? 0;

    total += current < next ? -current : current;
  }

  return total;
}

function validateRoman(roman: unknown): RomanValidationResult {
  if (typeof roman !== 'string') {
    return { valid: false, reason: 'Roman numeral must be a string' };
  }

  if (roman.length === 0) {
    return { valid: false, reason: 'Roman numeral cannot be empty' };
  }

  if (roman.trim() !== roman) {
    return { valid: false, reason: 'Roman numeral cannot include whitespace' };
  }

  if (roman !== roman.toUpperCase()) {
    return { valid: false, reason: 'Roman numeral must use uppercase letters' };
  }

  if (!ROMAN_CHARACTERS.test(roman)) {
    return { valid: false, reason: 'Roman numeral contains invalid characters' };
  }

  if (!STRICT_ROMAN_NUMERAL.test(roman)) {
    return { valid: false, reason: 'Roman numeral is not in strict subtractive notation' };
  }

  const value = romanToNumber(roman);

  if (value < 1 || value > 3999) {
    return { valid: false, reason: 'Roman numeral must be in the range 1-3999' };
  }

  return { valid: true, value };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = validateRoman(body?.roman);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
