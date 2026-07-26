// Date Constants
export const MIN_VIEWER_AGE_YEARS = 13;
export const MAX_REASONABLE_AGE_YEARS = 120;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// Validation Constants
export const MAX_PROOF_LINKS = 10;
export const MIN_PROOF_LINKS_REQUIRED = 1;

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_DATE: 'INVALID_DATE',
  FUTURE_DATE: 'FUTURE_DATE',
  INVALID_METHOD: 'INVALID_METHOD',
  INVALID_MODE: 'INVALID_MODE',
  PENDING_REQUEST_EXISTS: 'PENDING_REQUEST_EXISTS',
} as const;

// API Constants
export const API_VERSION = '1.0.0';

// Regex Patterns
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

// Verification Constants
export const VERIFICATION_METHODS: Array<'social' | 'id' | 'kyc'> = ['social', 'id', 'kyc'];
export const COLOR_BLIND_MODES: Array<'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'> = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
];

// Request Statuses
export const VERIFICATION_STATUSES: Array<'pending' | 'approved' | 'rejected' | 'cancelled'> = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
];