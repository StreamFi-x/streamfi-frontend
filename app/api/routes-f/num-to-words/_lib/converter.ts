import { NumberStyle } from './types';

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];

const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
];

const SCALES = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'
];

/**
 * Converts a number to its cardinal English word representation.
 * Range: -1 quadrillion to 1 quadrillion.
 */
export function toCardinal(n: number): string {
  if (n === 0) return ONES[0];
  
  if (n < 0) {
    return `negative ${toCardinal(Math.abs(n))}`;
  }

  const parts: string[] = [];
  let scaleIndex = 0;
  let remaining = Math.abs(n);

  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkWords = convertChunk(chunk);
      const scale = SCALES[scaleIndex];
      parts.unshift(scale ? `${chunkWords} ${scale}` : chunkWords);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }

  return parts.join(' ').trim();
}

/**
 * Converts a 3-digit chunk to words.
 */
function convertChunk(n: number): string {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    words.push(`${ONES[hundreds]} hundred`);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      words.push(ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      words.push(ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens]);
    }
  }

  return words.join(' ');
}

/**
 * Converts a number to its ordinal English word representation.
 */
export function toOrdinal(n: number): string {
  const cardinal = toCardinal(n);
  
  // Rule: Only the last word of the cardinal representation is transformed.
  const words = cardinal.split(' ');
  const lastWord = words.pop()!;
  
  let ordinalLastWord = '';

  // Special cases for ordinals
  const ordinalMap: Record<string, string> = {
    'one': 'first',
    'two': 'second',
    'three': 'third',
    'five': 'fifth',
    'eight': 'eighth',
    'nine': 'ninth',
    'twelve': 'twelfth',
    'zero': 'zeroth'
  };

  // Handle hyphenated numbers (e.g., twenty-one -> twenty-first)
  if (lastWord.includes('-')) {
    const [tens, ones] = lastWord.split('-');
    if (ordinalMap[ones]) {
      ordinalLastWord = `${tens}-${ordinalMap[ones]}`;
    } else {
      ordinalLastWord = `${tens}-${ones}th`;
    }
  } else if (ordinalMap[lastWord]) {
    ordinalLastWord = ordinalMap[lastWord];
  } else if (lastWord.endsWith('y')) {
    // twenty -> twentieth
    ordinalLastWord = lastWord.slice(0, -1) + 'ieth';
  } else {
    ordinalLastWord = lastWord + 'th';
  }

  words.push(ordinalLastWord);
  return words.join(' ');
}

/**
 * Main entry point for conversion.
 */
export function convertNumberToWords(n: number, style: NumberStyle = 'short'): string {
  if (style === 'ordinal') {
    return toOrdinal(n);
  }
  return toCardinal(n);
}
