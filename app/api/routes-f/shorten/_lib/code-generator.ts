import { UrlStorage } from './storage';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 100;

/**
 * Generate a collision-safe 6-character code
 */
export function generateCode(): string {
  let attempts = 0;
  
  while (attempts < MAX_ATTEMPTS) {
    const code = generateRandomCode();
    
    // Check if code already exists in storage
    if (!UrlStorage.has(code)) {
      return code;
    }
    
    attempts++;
  }
  
  // If we can't find a unique code after MAX_ATTEMPTS, throw an error
  throw new Error('Unable to generate unique code after maximum attempts');
}

/**
 * Generate a random 6-character code
 */
function generateRandomCode(): string {
  let code = '';
  
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[randomIndex];
  }
  
  return code;
}

/**
 * Validate that a code follows the expected format
 */
export function isValidCode(code: string): boolean {
  return /^[a-zA-Z0-9]{6}$/.test(code);
}
