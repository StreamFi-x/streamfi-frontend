const ROMAN_NUMERALS = [
  { value: 1000, numeral: 'M' },
  { value: 900, numeral: 'CM' },
  { value: 500, numeral: 'D' },
  { value: 400, numeral: 'CD' },
  { value: 100, numeral: 'C' },
  { value: 90, numeral: 'XC' },
  { value: 50, numeral: 'L' },
  { value: 40, numeral: 'XL' },
  { value: 10, numeral: 'X' },
  { value: 9, numeral: 'IX' },
  { value: 5, numeral: 'V' },
  { value: 4, numeral: 'IV' },
  { value: 1, numeral: 'I' }
];

const ROMAN_VALUES: Record<string, number> = {
  'I': 1,
  'V': 5,
  'X': 10,
  'L': 50,
  'C': 100,
  'D': 500,
  'M': 1000
};

export function numberToRoman(num: number): string {
  if (num < 1 || num > 3999) {
    throw new Error('Number must be between 1 and 3999');
  }

  let result = '';
  let remaining = num;

  for (const { value, numeral } of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

export function romanToNumber(roman: string): number {
  if (!roman || typeof roman !== 'string') {
    throw new Error('Invalid Roman numeral');
  }

  const upperRoman = roman.toUpperCase().trim();
  
  // Validate characters
  for (const char of upperRoman) {
    if (!ROMAN_VALUES[char]) {
      throw new Error('Invalid Roman numeral character');
    }
  }

  let result = 0;
  let i = 0;

  while (i < upperRoman.length) {
    const current = ROMAN_VALUES[upperRoman[i]];
    const next = i + 1 < upperRoman.length ? ROMAN_VALUES[upperRoman[i + 1]] : 0;

    if (current < next) {
      // Subtractive notation
      result += next - current;
      i += 2;
    } else {
      // Additive notation
      result += current;
      i += 1;
    }
  }

  // Validate the result is within range
  if (result < 1 || result > 3999) {
    throw new Error('Roman numeral out of range (1-3999)');
  }

  // Validate by converting back to Roman and comparing
  const reconverted = numberToRoman(result);
  if (reconverted !== upperRoman) {
    throw new Error('Invalid Roman numeral format');
  }

  return result;
}
