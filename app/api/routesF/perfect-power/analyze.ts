import type { PerfectPowerResult } from './types';

const NON_NEGATIVE_INTEGER = /^\d+$/;

function isInteger(value: number) {
  return Number.isFinite(value) && Math.floor(value) === value;
}

export function parsePositiveInteger(value: string): number | null {
  if (!NON_NEGATIVE_INTEGER.test(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function analyzePerfectPower(n: number): PerfectPowerResult {
  const result: PerfectPowerResult = {
    is_square: false,
    is_cube: false,
    is_perfect_power: false,
  };

  const sqrt = Math.sqrt(n);
  if (isInteger(sqrt)) {
    result.is_square = true;
    result.sqrt = Math.trunc(sqrt);
  }

  const cbrt = Math.cbrt(n);
  if (isInteger(cbrt)) {
    result.is_cube = true;
    result.cbrt = Math.trunc(cbrt);
  }

  if (n === 0) {
    result.is_perfect_power = true;
    result.base = 0;
    result.exponent = 2;
    return result;
  }

  if (n === 1) {
    result.is_perfect_power = true;
    result.base = 1;
    result.exponent = 2;
    return result;
  }

  const maxExponent = Math.floor(Math.log2(n));

  for (let exponent = maxExponent; exponent >= 2; exponent--) {
    const base = Math.round(n ** (1 / exponent));
    if (base < 2) continue;
    const power = base ** exponent;
    if (power === n) {
      result.is_perfect_power = true;
      result.base = base;
      result.exponent = exponent;
      break;
    }

    const lower = base - 1;
    if (lower >= 2 && lower ** exponent === n) {
      result.is_perfect_power = true;
      result.base = lower;
      result.exponent = exponent;
      break;
    }

    const higher = base + 1;
    if (higher ** exponent === n) {
      result.is_perfect_power = true;
      result.base = higher;
      result.exponent = exponent;
      break;
    }
  }

  return result;
}
