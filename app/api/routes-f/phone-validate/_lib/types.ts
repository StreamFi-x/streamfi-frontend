export interface PhoneValidationRequest {
  phone: string;
  default_country?: string; // ISO 3166-1 alpha-2, e.g., 'US', 'GB', 'NG'
}

export interface PhoneValidationResponse {
  valid: boolean;
  normalized: string;
  country_code: string;
  country: string;
  format_international: string;
  format_national: string;
}

export interface CountryData {
  name: string;
  dialCode: string;
  iso2: string;
  iso3: string;
  minLength: number;
  maxLength: number;
  formatNational: (digits: string) => string;
  formatInternational: (digits: string, dialCode: string) => string;
}