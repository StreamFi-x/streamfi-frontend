import { randomInt } from "crypto";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const AMBIGUOUS = new Set(["0", "O", "1", "l", "I"]);

function stripAmbiguous(s: string): string {
  return s.split("").filter((c) => !AMBIGUOUS.has(c)).join("");
}

function calcStrength(length: number, activeClasses: number): number {
  if (activeClasses <= 1) return 0;
  if (activeClasses === 2) return 1;
  if (activeClasses === 3) return 2;
  if (length < 12) return 3;
  return 4;
}

function buildPassword(length: number, charset: string, mustIncludes: string[]): string {
  // Place must_include substrings; fill the rest with random charset chars
  const result = Array.from({ length }, () => charset[randomInt(0, charset.length)]);

  // Insert each must_include at a non-overlapping random position
  const occupied = new Uint8Array(length);
  for (const sub of mustIncludes) {
    // Collect valid start positions
    const valid: number[] = [];
    outer: for (let pos = 0; pos <= length - sub.length; pos++) {
      for (let k = 0; k < sub.length; k++) {
        if (occupied[pos + k]) continue outer;
      }
      valid.push(pos);
    }
    if (valid.length === 0) continue;
    const start = valid[randomInt(0, valid.length)];
    for (let k = 0; k < sub.length; k++) {
      result[start + k] = sub[k];
      occupied[start + k] = 1;
    }
  }

  return result.join("");
}

export interface GenerateOptions {
  length: number;
  count: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  mustInclude: string[];
}

export interface GenerateResult {
  passwords: string[];
  strength_score: number;
}

export function generate(opts: GenerateOptions): GenerateResult {
  let upper = opts.uppercase ? UPPER : "";
  let lower = opts.lowercase ? LOWER : "";
  let dig = opts.digits ? DIGITS : "";
  let sym = opts.symbols ? SYMBOLS : "";

  if (opts.excludeAmbiguous) {
    upper = stripAmbiguous(upper);
    lower = stripAmbiguous(lower);
    dig = stripAmbiguous(dig);
    sym = stripAmbiguous(sym);
  }

  const charset = upper + lower + dig + sym;
  const activeClasses = [upper, lower, dig, sym].filter((s) => s.length > 0).length;

  const passwords = Array.from({ length: opts.count }, () =>
    buildPassword(opts.length, charset, opts.mustInclude)
  );

  return { passwords, strength_score: calcStrength(opts.length, activeClasses) };
}
