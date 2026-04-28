/**
 * @jest-environment jsdom
 */

import { generateCode, isValidCode } from '../_lib/code-generator';
import { UrlStorage } from '../_lib/storage';

// Mock UrlStorage
jest.mock('../_lib/storage', () => ({
  UrlStorage: {
    has: jest.fn()
  }
}));

const mockUrlStorage = UrlStorage as jest.Mocked<typeof UrlStorage>;

describe('Code Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUrlStorage.has.mockReturnValue(false);
  });

  describe('generateCode', () => {
    it('should generate a 6-character code', () => {
      const code = generateCode();
      expect(code).toHaveLength(6);
      expect(isValidCode(code)).toBe(true);
    });

    it('should generate alphanumeric codes', () => {
      const code = generateCode();
      expect(/^[a-zA-Z0-9]{6}$/.test(code)).toBe(true);
    });

    it('should check for collisions', () => {
      mockUrlStorage.has.mockReturnValue(false);
      generateCode();
      expect(mockUrlStorage.has).toHaveBeenCalled();
    });

    it('should retry on collision', () => {
      // Mock first call to return true (collision), then false (available)
      mockUrlStorage.has
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const code = generateCode();
      expect(mockUrlStorage.has).toHaveBeenCalledTimes(2);
      expect(code).toHaveLength(6);
    });

    it('should throw error after max attempts', () => {
      // Always return true to simulate constant collisions
      mockUrlStorage.has.mockReturnValue(true);

      expect(() => generateCode()).toThrow(
        'Unable to generate unique code after maximum attempts'
      );
    });

    it('should generate different codes on multiple calls', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        const code = generateCode();
        codes.add(code);
      }
      // With 62^6 possible combinations, we should get 100 unique codes
      expect(codes.size).toBe(100);
    });
  });

  describe('isValidCode', () => {
    it('should return true for valid 6-character codes', () => {
      expect(isValidCode('abc123')).toBe(true);
      expect(isValidCode('ABCDEF')).toBe(true);
      expect(isValidCode('123456')).toBe(true);
      expect(isValidCode('a1b2c3')).toBe(true);
      expect(isValidCode('Z9Y8X7')).toBe(true);
    });

    it('should return false for codes with invalid length', () => {
      expect(isValidCode('abc12')).toBe(false); // 5 chars
      expect(isValidCode('abc1234')).toBe(false); // 7 chars
      expect(isValidCode('ab')).toBe(false); // 2 chars
      expect(isValidCode('')).toBe(false); // 0 chars
    });

    it('should return false for codes with invalid characters', () => {
      expect(isValidCode('abc!23')).toBe(false);
      expect(isValidCode('abc-23')).toBe(false);
      expect(isValidCode('abc_23')).toBe(false);
      expect(isValidCode('abc 23')).toBe(false);
      expect(isValidCode('abc@23')).toBe(false);
      expect(isValidCode('abc#23')).toBe(false);
    });

    it('should return false for codes with special characters only', () => {
      expect(isValidCode('!@#$%^')).toBe(false);
      expect(isValidCode('******')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isValidCode(null as any)).toBe(false);
      expect(isValidCode(undefined as any)).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isValidCode(123456 as any)).toBe(false);
      expect(isValidCode({} as any)).toBe(false);
      expect(isValidCode([] as any)).toBe(false);
    });
  });
});
