export interface CardValidationRequest {
  number: string;
}

export interface CardValidationResponse {
  valid: boolean;
  brand: string | null;
  last4: string;
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover';