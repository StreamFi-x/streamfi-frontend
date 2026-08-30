/** Only case-insensitive ("i") and global ("g") flags are permitted. */
const ALLOWED_FLAGS = new Set(["i", "g"]);

/** Patterns longer than this are rejected outright. */
export const MAX_PATTERN_LENGTH = 200;

/**
 * Nested-quantifier shapes such as `(a+)+`, `(a*)*`, `(a+)*` are the classic
 * catastrophic-backtracking building blocks. This is a heuristic, not a
 * proof of linear-time matching, but it blocks the well-known dangerous
 * shapes without pulling in a regex-analysis dependency.
 */
const NESTED_QUANTIFIER_RE = /\([^()]*[+*][^()]*\)[+*]/;

export type PatternValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateAutoBanPattern(
  pattern: unknown,
  flags: unknown
): PatternValidationResult {
  if (typeof pattern !== "string" || pattern.length === 0) {
    return { ok: false, error: "pattern must be a non-empty string" };
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      ok: false,
      error: `pattern must be at most ${MAX_PATTERN_LENGTH} characters`,
    };
  }

  const flagsValue = flags === undefined ? "" : flags;
  if (typeof flagsValue !== "string") {
    return { ok: false, error: "flags must be a string" };
  }
  for (const flag of flagsValue) {
    if (!ALLOWED_FLAGS.has(flag)) {
      return {
        ok: false,
        error: `flags may only contain: ${Array.from(ALLOWED_FLAGS).join(", ")}`,
      };
    }
  }
  if (new Set(flagsValue).size !== flagsValue.length) {
    return { ok: false, error: "flags must not contain duplicates" };
  }

  if (NESTED_QUANTIFIER_RE.test(pattern)) {
    return {
      ok: false,
      error:
        "pattern contains a nested quantifier that risks catastrophic backtracking",
    };
  }

  try {
     
    new RegExp(pattern, flagsValue);
  } catch {
    return { ok: false, error: "pattern is not a valid regular expression" };
  }

  return { ok: true };
}
