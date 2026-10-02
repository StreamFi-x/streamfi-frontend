import type { NotationResponse, NotationStyle } from "./types";

const SI_PREFIXES = new Map<number, string>([
  [-24, "y"],
  [-21, "z"],
  [-18, "a"],
  [-15, "f"],
  [-12, "p"],
  [-9, "n"],
  [-6, "u"],
  [-3, "m"],
  [0, ""],
  [3, "k"],
  [6, "M"],
  [9, "G"],
  [12, "T"],
  [15, "P"],
  [18, "E"],
  [21, "Z"],
  [24, "Y"],
]);

const SI_EXPONENTS = new Map<string, number>([
  ["", 0],
  ["y", -24],
  ["z", -21],
  ["a", -18],
  ["f", -15],
  ["p", -12],
  ["n", -9],
  ["u", -6],
  ["\u00b5", -6],
  ["\u03bc", -6],
  ["m", -3],
  ["k", 3],
  ["K", 3],
  ["M", 6],
  ["G", 9],
  ["T", 12],
  ["P", 15],
  ["E", 18],
  ["Z", 21],
  ["Y", 24],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStyle(value: unknown): NotationStyle {
  if (value === undefined) {
    return "scientific";
  }

  if (value === "scientific" || value === "engineering") {
    return value;
  }

  throw new Error("style must be scientific or engineering.");
}

function normalizeSigFigs(value: unknown): number {
  if (value === undefined) {
    return 3;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 15) {
    throw new Error("sig_figs must be an integer from 1 to 15.");
  }

  return value;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }

  return value;
}

function normalizeExponent(exponentPart: string): number {
  return Number.parseInt(exponentPart.replace("+", ""), 10);
}

export function formatScientific(value: number, sigFigs = 3): string {
  if (Object.is(value, 0) || value === 0) {
    return "0e0";
  }

  const [coefficient, exponentPart] = value.toExponential(sigFigs - 1).split("e");
  return `${coefficient}e${normalizeExponent(exponentPart)}`;
}

export function formatEngineering(value: number, sigFigs = 3): string {
  if (Object.is(value, 0) || value === 0) {
    return "0";
  }

  let exponent = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
  let coefficient = value / 10 ** exponent;
  let coefficientText = coefficient.toPrecision(sigFigs);

  if (Math.abs(Number(coefficientText)) >= 1000) {
    exponent += 3;
    coefficient = value / 10 ** exponent;
    coefficientText = coefficient.toPrecision(sigFigs);
  }

  const suffix = SI_PREFIXES.get(exponent);
  if (suffix === undefined) {
    return `${coefficientText}e${exponent}`;
  }

  return suffix ? `${coefficientText} ${suffix}` : coefficientText;
}

export function parseScientific(value: unknown): number {
  if (typeof value === "number") {
    return finiteNumber(value, "value");
  }

  if (typeof value !== "string") {
    throw new Error("value must be a string or finite number.");
  }

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    throw new Error("value must be valid scientific notation.");
  }

  return parsed;
}

export function parseEngineering(value: unknown): number {
  if (typeof value === "number") {
    return finiteNumber(value, "value");
  }

  if (typeof value !== "string") {
    throw new Error("value must be a string or finite number.");
  }

  const match = value
    .trim()
    .match(
      /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([A-Za-z]|\u00b5|\u03bc)?$/
    );

  if (!match) {
    throw new Error("value must be valid engineering notation.");
  }

  const numberPart = Number(match[1]);
  const suffix = match[2] ?? "";
  const exponent = SI_EXPONENTS.get(suffix);

  if (!Number.isFinite(numberPart) || exponent === undefined) {
    throw new Error("value must be valid engineering notation.");
  }

  return numberPart * 10 ** exponent;
}

export function processNotation(input: unknown): NotationResponse {
  if (!isRecord(input)) {
    throw new Error("Request body must be an object.");
  }

  const style = normalizeStyle(input.style);

  if (input.mode === "format") {
    const value = finiteNumber(input.value, "value");
    const sigFigs = normalizeSigFigs(input.sig_figs);
    const result =
      style === "engineering"
        ? formatEngineering(value, sigFigs)
        : formatScientific(value, sigFigs);

    return { result };
  }

  if (input.mode === "parse") {
    const result =
      style === "engineering" ? parseEngineering(input.value) : parseScientific(input.value);
    return { result };
  }

  throw new Error("mode must be format or parse.");
}
