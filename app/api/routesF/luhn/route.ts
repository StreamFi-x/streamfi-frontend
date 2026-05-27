import { NextResponse } from 'next/server';

function calculateLuhnChecksum(numStr: string): number {
  let sum = 0;
  let isEven = false; // We start from the rightmost digit, moving left

  for (let i = numStr.length - 1; i >= 0; i--) {
    let digit = parseInt(numStr.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10;
}

function generateCheckDigit(numStr: string): number {
  const sum = calculateLuhnChecksum(numStr + '0');
  return (10 - sum) % 10;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { number, mode } = body;

    if (!number || typeof number !== 'string' || !/^\\d+$/.test(number)) {
      return NextResponse.json({ error: 'Invalid or missing number' }, { status: 400 });
    }

    if (mode === 'generate') {
      const checkDigit = generateCheckDigit(number);
      return NextResponse.json({ number: number + checkDigit, checkDigit });
    } else if (mode === 'validate') {
      const sum = calculateLuhnChecksum(number);
      return NextResponse.json({ valid: sum === 0 });
    } else {
      return NextResponse.json({ error: 'Invalid mode, use generate or validate' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
