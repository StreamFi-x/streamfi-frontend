import type { FizzBuzzRequestBody, FizzBuzzRule } from "./types";

const MAX_RANGE_SIZE = 10_000;
const DEFAULT_RULES: FizzBuzzRule[] = [
  { divisor: 3, replacement: "Fizz" },
  { divisor: 5, replacement: "Buzz" },
];

export function parseFizzBuzzRequest(body: unknown): FizzBuzzRequestBody {
  if (typeof body !== "object" || body === null) {
    throw new Error("Request body must be an object.");
  }

  const requestBody = body as Record<string, unknown>;
  const start = requestBody.start;
  const end = requestBody.end;
  const rules = requestBody.rules;

  if (typeof start !== "number" || !Number.isInteger(start)) {
    throw new Error("start must be an integer.");
  }

  if (typeof end !== "number" || !Number.isInteger(end)) {
    throw new Error("end must be an integer.");
  }

  if (start > end) {
    throw new Error("start must be less than or equal to end.");
  }

  const rangeSize = end - start + 1;
  if (rangeSize > MAX_RANGE_SIZE) {
    throw new Error(`Range size must not exceed ${MAX_RANGE_SIZE}.`);
  }

  if (rules === undefined) {
    return { start, end, rules: DEFAULT_RULES };
  }

  if (!Array.isArray(rules)) {
    throw new Error("rules must be an array.");
  }

  return { start, end, rules: parseRules(rules) };
}

export function buildFizzBuzzResponse({ start, end, rules }: FizzBuzzRequestBody) {
  const appliedRules = rules?.length ? rules : [];

  const output: string[] = [];
  for (let current = start; current <= end; current += 1) {
    let value = "";

    for (const rule of appliedRules) {
      if (current % rule.divisor === 0) {
        value += rule.replacement;
      }
    }

    output.push(value || String(current));
  }

  return output;
}

function parseRules(rawRules: unknown[]): FizzBuzzRule[] {
  return rawRules.map((rule, index) => {
    if (typeof rule !== "object" || rule === null) {
      throw new Error(`rules[${index}] must be an object.`);
    }

    const ruleRecord = rule as Record<string, unknown>;
    const divisor = ruleRecord.divisor;
    const replacement = ruleRecord.replacement;

    if (typeof divisor !== "number" || !Number.isInteger(divisor)) {
      throw new Error(`rules[${index}].divisor must be an integer.`);
    }

    if (divisor < 1) {
      throw new Error(`rules[${index}].divisor must be greater than or equal to 1.`);
    }

    if (typeof replacement !== "string") {
      throw new Error(`rules[${index}].replacement must be a string.`);
    }

    return { divisor, replacement };
  });
}
