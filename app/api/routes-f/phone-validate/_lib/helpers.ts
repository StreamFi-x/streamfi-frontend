import { CountryData, PhoneValidationResponse } from './types';
import { COUNTRIES, DIAL_CODES_SORTED, DIAL_CODE_MAP } from './countries';

// strip spaces, dashes, parentheses, dots, and leading zeros
export function sanitizePhone(input: string): string {
  return input
    .replace(/[\s\-\.\(\)]/g, '') // remove spaces, dashes, dots, parens
    .replace(/^0+/, ''); // strip leading zeros
}

// extract country and national digits from a phone number
 // returns null if no valid country code is found
export function extractCountryAndDigits(cleanNumber: string): { country: CountryData; nationalDigits: string } | null {
  // must start with + or be all digits
  let digits = cleanNumber;
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  //try to match dial codes
  for (const dialCode of DIAL_CODES_SORTED) {
    if (digits.startsWith(dialCode)) {
      const nationalDigits = digits.slice(dialCode.length);
      const countryCodes = DIAL_CODE_MAP[dialCode];
      if (countryCodes && countryCodes.length > 0) {
        // for shared dial codes (like +1), can't determine exact country from number alone
        // return the first one as default; caller can use default_country to disambiguate
        return { country: COUNTRIES[countryCodes[0]], nationalDigits };
      }
    }
  }

  return null;
}

// detect country using default_country hint
export function detectCountry(
  cleanNumber: string,
  defaultCountry?: string
): { country: CountryData; nationalDigits: string; dialCode: string } | null {
  let digits = cleanNumber;
  const hasPlus = digits.startsWith('+');
  if (hasPlus) {
    digits = digits.slice(1);
  }

  // if number starts with + try to extract dial code
  if (hasPlus) {
    const extracted = extractCountryAndDigits(cleanNumber);
    if (extracted) {
      // If multiple countries share this dial code, use default_country to disambiguate
      const dialCode = extracted.country.dialCode;
      const candidates = DIAL_CODE_MAP[dialCode] || [];
      if (candidates.length > 1 && defaultCountry && COUNTRIES[defaultCountry]) {
        return {
          country: COUNTRIES[defaultCountry],
          nationalDigits: extracted.nationalDigits,
          dialCode,
        };
      }
      return { country: extracted.country, nationalDigits: extracted.nationalDigits, dialCode };
    }
    return null;
  }

  // No + prefix — use default_country
  if (defaultCountry && COUNTRIES[defaultCountry]) {
    const country = COUNTRIES[defaultCountry];
    // strip leading zeros from national number if any
    const nationalDigits = digits.replace(/^0+/, '');
    return { country, nationalDigits, dialCode: country.dialCode };
  }

  return null;
}

// Validate phone number and build response
export function validatePhone(
  cleanNumber: string,
  defaultCountry?: string
): PhoneValidationResponse | { error: string; status: number } {
  // reject if > 15 digits (E.164 max is 15)
  const digitsOnly = cleanNumber.replace(/^\+/, '');
  if (digitsOnly.length > 15) {
    return { error: 'Phone number exceeds maximum E.164 length of 15 digits', status: 400 };
  }

  const detection = detectCountry(cleanNumber, defaultCountry);

  if (!detection) {
    return {
      valid: false,
      normalized: cleanNumber,
      country_code: '',
      country: '',
      format_international: '',
      format_national: '',
    };
  }

  const { country, nationalDigits, dialCode } = detection;

  // validate length
  if (nationalDigits.length < country.minLength || nationalDigits.length > country.maxLength) {
    return {
      valid: false,
      normalized: `+${dialCode}${nationalDigits}`,
      country_code: dialCode,
      country: country.name,
      format_international: '',
      format_national: '',
    };
  }

  // validate all digits
  if (!/^\d+$/.test(nationalDigits)) {
    return {
      valid: false,
      normalized: `+${dialCode}${nationalDigits}`,
      country_code: dialCode,
      country: country.name,
      format_international: '',
      format_national: '',
    };
  }

  const normalized = `+${dialCode}${nationalDigits}`;

  return {
    valid: true,
    normalized,
    country_code: dialCode,
    country: country.name,
    format_international: country.formatInternational(nationalDigits, dialCode),
    format_national: country.formatNational(nationalDigits),
  };
}