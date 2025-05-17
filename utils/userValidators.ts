// utils/userValidators.ts
import { SocialLink, Creator, UserRegistrationInput, UserUpdateInput } from '../types/user';

/**
 * Validates a social link object
 */
export function validateSocialLink(socialLink: any): boolean {
  if (!socialLink || typeof socialLink !== 'object') return false;
  
  // Check if socialTitle exists and is a string
  if (!socialLink.socialTitle || typeof socialLink.socialTitle !== 'string') return false;
  
  // Check if socialLink exists and is a string
  if (!socialLink.socialLink || typeof socialLink.socialLink !== 'string') return false;
  
  // Basic URL validation
  try {
    new URL(socialLink.socialLink);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validates an array of social links
 */
export function validateSocialLinks(socialLinks: any): boolean {
  if (!Array.isArray(socialLinks)) return false;
  
  // If array is empty, it's valid
  if (socialLinks.length === 0) return true;
  
  // Check each social link
  return socialLinks.every(link => validateSocialLink(link));
}

/**
 * Validates creator object
 */
export function validateCreator(creator: any): boolean {
  if (!creator || typeof creator !== 'object') return false;
  
  // streamTitle should be a string if provided
  if (creator.streamTitle !== undefined && typeof creator.streamTitle !== 'string') return false;
  
  // tags should be an array of strings if provided
  if (creator.tags !== undefined) {
    if (!Array.isArray(creator.tags)) return false;
    if (!creator.tags.every((tag: string) => typeof tag === 'string')) return false;

  }
  
  // category should be a string if provided
  if (creator.category !== undefined && typeof creator.category !== 'string') return false;
  
  // payout should be a string if provided
  if (creator.payout !== undefined && typeof creator.payout !== 'string') return false;
  
  return true;
}

/**
 * Validates a complete user registration input
 */
export function validateUserRegistration(input: UserRegistrationInput): { isValid: boolean; error?: string } {
  // Check required fields
  if (!input.email) return { isValid: false, error: "Email is required" };
  if (!input.username) return { isValid: false, error: "Username is required" };
  if (!input.wallet) return { isValid: false, error: "Wallet is required" };
  
  // Validate email (assuming validateEmail function exists elsewhere in your codebase)
  // if (!validateEmail(input.email)) return { isValid: false, error: "Invalid email format" };
  
  // Validate social links if provided
  if (input.socialLinks && !validateSocialLinks(input.socialLinks)) {
    return { isValid: false, error: "Invalid social links format" };
  }
  
  // Validate creator object if provided
  if (input.creator && !validateCreator(input.creator)) {
    return { isValid: false, error: "Invalid creator data format" };
  }
  
  return { isValid: true };
}

/**
 * Validates user update input
 */
export function validateUserUpdate(input: UserUpdateInput): { isValid: boolean; error?: string } {
  // Check if at least one field is provided
  if (Object.keys(input).length === 0) {
    return { isValid: false, error: "No update fields provided" };
  }
  
  // Validate email if provided
  // if (input.email && !validateEmail(input.email)) {
  //   return { isValid: false, error: "Invalid email format" };
  // }
  
  // Validate social links if provided
  if (input.socialLinks && !validateSocialLinks(input.socialLinks)) {
    return { isValid: false, error: "Invalid social links format" };
  }
  
  // Validate creator object if provided
  if (input.creator && !validateCreator(input.creator)) {
    return { isValid: false, error: "Invalid creator data format" };
  }
  
  return { isValid: true };
}