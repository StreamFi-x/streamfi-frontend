import type { ValidationError } from './types';

/**
 * Validate a URL string and return error if invalid
 */
export function validateUrl(url: string): ValidationError | null {
  // Check if URL is empty or whitespace
  if (!url || url.trim().length === 0) {
    return {
      message: 'URL cannot be empty',
      code: 'EMPTY_URL'
    };
  }

  const trimmedUrl = url.trim();

  try {
    // Use URL constructor to validate the URL format
    const parsedUrl = new URL(trimmedUrl);
    
    // Only allow http and https schemes
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        message: 'Only HTTP and HTTPS URLs are allowed',
        code: 'UNSAFE_SCHEME'
      };
    }
    
    return null; // Valid URL
  } catch (error) {
    return {
      message: 'Invalid URL format',
      code: 'INVALID_URL'
    };
  }
}

/**
 * Check if a URL is valid (returns boolean)
 */
export function isValidUrl(url: string): boolean {
  return validateUrl(url) === null;
}
