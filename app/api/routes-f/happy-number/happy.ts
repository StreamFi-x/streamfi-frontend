// #863 feat(routes-f): happy number checker

export type HappyNumberResult = {
  n: number;
  is_happy: boolean;
  sequence: number[];
};

function sumOfSquaredDigits(n: number): number {
  let sum = 0;
  let value = n;

  while (value > 0) {
    const digit = value % 10;
    sum += digit * digit;
    value = Math.floor(value / 10);
  }

  return sum;
}

/**
 * Determine whether `n` is a happy number and return the iteration sequence
 * until reaching 1 (happy) or detecting a cycle (unhappy).
 */
export function analyzeHappyNumber(n: number): HappyNumberResult {
  const sequence: number[] = [n];
  const seen = new Set<number>([n]);
  let current = n;

  while (current !== 1) {
    current = sumOfSquaredDigits(current);

    if (seen.has(current)) {
      sequence.push(current);
      return { n, is_happy: false, sequence };
    }

    seen.add(current);
    sequence.push(current);
  }

  return { n, is_happy: true, sequence };
}

export function parsePositiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
