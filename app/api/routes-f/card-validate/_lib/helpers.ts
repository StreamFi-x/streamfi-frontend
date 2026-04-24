import { CardBrand } from './types';
/**
 * Strip spaces and dashes from card number
 */
export function sanitizeCardNumber(input: string): string {
  return input.replace(/[\s-]/g, '');
}
/**
 * Detect card brand from IIN (Issuer Identification Number) prefix
 * Visa: 4
 * Mastercard: 51-55, 2221-2720
 * Amex: 34, 37
 * Discover: 6011, 65
 */
export function detectBrand(cleanNumber: string): CardBrand | null {
  if (!cleanNumber || cleanNumber.length < 2) return null;

  const firstDigit = cleanNumber.charAt(0);
  const firstTwo = cleanNumber.slice(0, 2);
  const firstFour = cleanNumber.slice(0, 4);

  // Visa: starts with 4
  if (firstDigit === '4') {
    return 'visa';
  }

//  Amex: starts with 34 or 37
  if (firstTwo === '34' || firstTwo === '37') {
    return 'amex';
  }

  // Discover: starts with 6011 or 65
  if (firstFour === '6011' || firstTwo === '65') {
    return 'discover';
  }

  // Mastercard: 51-55 or 2221-2720
  const prefix2 = parseInt(firstTwo, 10);
  if (prefix2 >= 51 && prefix2 <= 55) {
    return 'mastercard';
  }

  const prefix4 = parseInt(firstFour, 10);
  if (prefix4 >= 2221 && prefix4 <= 2720) {
    return 'mastercard';
  }

  return null;
}

/**
 * Luhn algorithm validation
 * 1. Starting from the right, double every second digit
 * 2. If doubling results in a number > 9, subtract 9
 * 3. Sum all digits
 * 4. Valid if sum % 10 === 0
 */
export function luhnCheck(cleanNumber: string): boolean {
  if (!/^\d+$/.test(cleanNumber)) return false;
  if (cleanNumber.length <= 1) return false;

  let sum = 0;
  let isEvenPosition = false;

  // Iterate from right to left
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber.charAt(i), 10);

    if (isEvenPosition) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEvenPosition = !isEvenPosition;
  }

  return sum % 10 === 0;
}

/**
 * Extract last 4 digits safely — never expose full PAN
 */
export function getLast4(cleanNumber: string): string {
  if (cleanNumber.length < 4) {
    return cleanNumber.padStart(4, '0');
  }
  return cleanNumber.slice(-4);
}