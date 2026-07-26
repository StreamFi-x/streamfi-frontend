import { 
  MIN_VIEWER_AGE_YEARS, 
  MAX_REASONABLE_AGE_YEARS,
  MILLISECONDS_PER_DAY,
  ISO_DATE_REGEX 
} from '../constants';
import type { DateValidationResult } from '../types';

/**
 * Parse and validate an ISO date string
 */
export function validateDate(dateStr: string): DateValidationResult {
  // Check format
  if (!ISO_DATE_REGEX.test(dateStr)) {
    return {
      isValid: false,
      error: 'Date must be in YYYY-MM-DD format',
    };
  }

  // Parse date
  const date = new Date(dateStr);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: 'Invalid date',
    };
  }

  // Check if date is in the future
  const now = new Date();
  if (date > now) {
    return {
      isValid: false,
      error: 'Birthday cannot be in the future',
    };
  }

  // Calculate age
  const ageInYears = calculateAgeInYears(date);
  
  // Check minimum age (for viewers)
  if (ageInYears < MIN_VIEWER_AGE_YEARS) {
    return {
      isValid: false,
      error: `Viewer must be at least ${MIN_VIEWER_AGE_YEARS} years old`,
    };
  }

  // Check maximum reasonable age
  if (ageInYears > MAX_REASONABLE_AGE_YEARS) {
    return {
      isValid: false,
      error: `Age exceeds maximum reasonable value of ${MAX_REASONABLE_AGE_YEARS} years`,
    };
  }

  return {
    isValid: true,
    date,
  };
}

/**
 * Calculate age in years from a birth date
 */
export function calculateAgeInYears(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / MILLISECONDS_PER_DAY);
}

/**
 * Calculate average of an array of numbers
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / numbers.length);
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current date as ISO string
 */
export function getCurrentISODate(): string {
  return formatDateToISO(new Date());
}

/**
 * Get current timestamp as ISO string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Calculate follow age in days from follow date to now
 */
export function calculateFollowAgeDays(followDate: Date): number {
  return daysBetween(followDate, new Date());
}