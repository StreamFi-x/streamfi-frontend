/**
 * @jest-environment jsdom
 */

import { validateUrl, isValidUrl } from '../_lib/validation';

describe('URL Validation', () => {
  describe('validateUrl', () => {
    it('should return null for valid HTTP URL', () => {
      const result = validateUrl('http://example.com');
      expect(result).toBeNull();
    });

    it('should return null for valid HTTPS URL', () => {
      const result = validateUrl('https://secure.example.com');
      expect(result).toBeNull();
    });

    it('should return null for valid HTTPS URL with path and query', () => {
      const result = validateUrl('https://example.com/path/to/page?query=value&other=test');
      expect(result).toBeNull();
    });

    it('should return null for valid URL with port', () => {
      const result = validateUrl('http://localhost:3000');
      expect(result).toBeNull();
    });

    it('should return null for valid URL trimmed', () => {
      const result = validateUrl('  https://example.com  ');
      expect(result).toBeNull();
    });

    it('should return error for empty URL', () => {
      const result = validateUrl('');
      expect(result).toEqual({
        message: 'URL cannot be empty',
        code: 'EMPTY_URL'
      });
    });

    it('should return error for whitespace-only URL', () => {
      const result = validateUrl('   ');
      expect(result).toEqual({
        message: 'URL cannot be empty',
        code: 'EMPTY_URL'
      });
    });

    it('should return error for FTP URL', () => {
      const result = validateUrl('ftp://example.com');
      expect(result).toEqual({
        message: 'Only HTTP and HTTPS URLs are allowed',
        code: 'UNSAFE_SCHEME'
      });
    });

    it('should return error for file URL', () => {
      const result = validateUrl('file:///path/to/file');
      expect(result).toEqual({
        message: 'Only HTTP and HTTPS URLs are allowed',
        code: 'UNSAFE_SCHEME'
      });
    });

    it('should return error for javascript URL', () => {
      const result = validateUrl('javascript:alert("xss")');
      expect(result).toEqual({
        message: 'Only HTTP and HTTPS URLs are allowed',
        code: 'UNSAFE_SCHEME'
      });
    });

    it('should return error for data URL', () => {
      const result = validateUrl('data:text/plain,Hello');
      expect(result).toEqual({
        message: 'Only HTTP and HTTPS URLs are allowed',
        code: 'UNSAFE_SCHEME'
      });
    });

    it('should return error for invalid URL format', () => {
      const result = validateUrl('not-a-valid-url');
      expect(result).toEqual({
        message: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    });

    it('should return error for URL without protocol', () => {
      const result = validateUrl('www.example.com');
      expect(result).toEqual({
        message: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    });

    it('should return error for URL with invalid characters', () => {
      const result = validateUrl('http://example[dot]com');
      expect(result).toEqual({
        message: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid HTTP URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should return true for valid HTTPS URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(isValidUrl('invalid-url')).toBe(false);
    });

    it('should return false for empty URL', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('should return false for FTP URL', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });
});
