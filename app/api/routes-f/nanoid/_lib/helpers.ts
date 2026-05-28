import { randomBytes } from "crypto";

const DEFAULT_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const DEFAULT_SIZE = 21;
const DEFAULT_COUNT = 1;
const MAX_COUNT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function generateId(size: number, alphabet: string): string {
  const alphabetLength = alphabet.length;
  // Use rejection sampling to avoid modulo bias
  const mask = Math.pow(2, Math.ceil(Math.log2(alphabetLength))) - 1;
  const bytesNeeded = Math.ceil((size * 1.6) / 1); // slight overallocation
  let id = "";

  while (id.length < size) {
    const bytes = randomBytes(bytesNeeded);
    for (let i = 0; i < bytes.length && id.length < size; i++) {
      const byte = bytes[i] & mask;
      if (byte < alphabetLength) {
        id += alphabet[byte];
      }
    }
  }

  return id;
}

export function parseAndGenerate(input: unknown): { ids: string[] } {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  let count = DEFAULT_COUNT;
  let size = DEFAULT_SIZE;
  let alphabet = DEFAULT_ALPHABET;

  if (input.count !== undefined) {
    if (
      typeof input.count !== "number" ||
      !Number.isInteger(input.count) ||
      input.count < 1
    ) {
      throw new Error("count must be a positive integer.");
    }
    if (input.count > MAX_COUNT) {
      throw new Error(`count must not exceed ${MAX_COUNT}.`);
    }
    count = input.count;
  }

  if (input.size !== undefined) {
    if (
      typeof input.size !== "number" ||
      !Number.isInteger(input.size) ||
      input.size < 1
    ) {
      throw new Error("size must be a positive integer.");
    }
    size = input.size;
  }

  if (input.alphabet !== undefined) {
    if (typeof input.alphabet !== "string" || input.alphabet.length < 2) {
      throw new Error("alphabet must be a string with at least 2 characters.");
    }
    alphabet = input.alphabet;
  }

  const ids = Array.from({ length: count }, () => generateId(size, alphabet));
  return { ids };
}
