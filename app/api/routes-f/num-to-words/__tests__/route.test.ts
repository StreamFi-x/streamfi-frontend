import { convertNumberToWords } from '../_lib/converter';

describe('Number to Words Converter', () => {
  describe('Cardinal Style', () => {
    test('converts zero', () => {
      expect(convertNumberToWords(0)).toBe('zero');
    });

    test('converts single digits', () => {
      expect(convertNumberToWords(5)).toBe('five');
    });

    test('converts teens', () => {
      expect(convertNumberToWords(13)).toBe('thirteen');
    });

    test('converts tens', () => {
      expect(convertNumberToWords(20)).toBe('twenty');
      expect(convertNumberToWords(21)).toBe('twenty-one');
    });

    test('converts hundreds', () => {
      expect(convertNumberToWords(100)).toBe('one hundred');
      expect(convertNumberToWords(123)).toBe('one hundred twenty-three');
    });

    test('converts large numbers', () => {
      expect(convertNumberToWords(1000)).toBe('one thousand');
      expect(convertNumberToWords(1000000)).toBe('one million');
      expect(convertNumberToWords(1234567)).toBe('one million two hundred thirty-four thousand five hundred sixty-seven');
    });

    test('converts negative numbers', () => {
      expect(convertNumberToWords(-1)).toBe('negative one');
      expect(convertNumberToWords(-123)).toBe('negative one hundred twenty-three');
    });

    test('converts boundary value: 1 quadrillion', () => {
      expect(convertNumberToWords(1000000000000000)).toBe('one quadrillion');
    });

    test('converts boundary value: -1 quadrillion', () => {
      expect(convertNumberToWords(-1000000000000000)).toBe('negative one quadrillion');
    });
  });

  describe('Ordinal Style', () => {
    test('converts zero to zeroth', () => {
      expect(convertNumberToWords(0, 'ordinal')).toBe('zeroth');
    });

    test('converts single digits', () => {
      expect(convertNumberToWords(1, 'ordinal')).toBe('first');
      expect(convertNumberToWords(2, 'ordinal')).toBe('second');
      expect(convertNumberToWords(3, 'ordinal')).toBe('third');
      expect(convertNumberToWords(4, 'ordinal')).toBe('fourth');
    });

    test('converts irregular ordinals', () => {
      expect(convertNumberToWords(5, 'ordinal')).toBe('fifth');
      expect(convertNumberToWords(8, 'ordinal')).toBe('eighth');
      expect(convertNumberToWords(9, 'ordinal')).toBe('ninth');
      expect(convertNumberToWords(12, 'ordinal')).toBe('twelfth');
    });

    test('converts compound ordinals', () => {
      expect(convertNumberToWords(21, 'ordinal')).toBe('twenty-first');
      expect(convertNumberToWords(100, 'ordinal')).toBe('one hundredth');
      expect(convertNumberToWords(123, 'ordinal')).toBe('one hundred twenty-third');
    });

    test('converts large ordinals', () => {
      expect(convertNumberToWords(1000, 'ordinal')).toBe('one thousandth');
      expect(convertNumberToWords(1000000, 'ordinal')).toBe('one millionth');
    });
  });
});
