import type { GcdLcmInput, GcdLcmResponse, Operation } from "./types";

const MAX_NUMBERS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function gcdTwo(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function lcmTwo(a: bigint, b: bigint): bigint {
  return (a / gcdTwo(a, b)) * b;
}

function computeGcd(nums: bigint[]): bigint {
  return nums.reduce((acc, n) => gcdTwo(acc, n));
}

function computeLcm(nums: bigint[]): bigint {
  return nums.reduce((acc, n) => lcmTwo(acc, n));
}

function normalizeOperation(value: unknown): Operation {
  if (value === undefined || value === "both") {return "both";}
  if (value === "gcd" || value === "lcm") {return value;}
  throw new Error("operation must be both, gcd, or lcm.");
}

export function processGcdLcm(input: unknown): GcdLcmResponse {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  const { numbers, operation: rawOp } = input as unknown as GcdLcmInput;
  const operation = normalizeOperation(rawOp);

  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error("numbers must be a non-empty array.");
  }

  if (numbers.length > MAX_NUMBERS) {
    throw new Error(`numbers array must not exceed ${MAX_NUMBERS} elements.`);
  }

  const bigNums: bigint[] = numbers.map((n, i) => {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      throw new Error(`numbers[${i}] must be a positive integer.`);
    }
    return BigInt(n);
  });

  const result: GcdLcmResponse = { n_count: numbers.length };

  if (operation === "gcd" || operation === "both") {
    result.gcd = Number(computeGcd(bigNums));
  }

  if (operation === "lcm" || operation === "both") {
    result.lcm = Number(computeLcm(bigNums));
  }

  return result;
}
