/**
 * Username normalization and homoglyph (confusable) protection.
 *
 * Every point that creates or changes a username must pass it through
 * `prepareUsername`, then reject it if an existing account has the same
 * skeleton (see lib/users/username-conflict.ts).
 *
 *  1. Normalize: NFKC (folds fullwidth and compatibility forms, composes
 *     accents so one visible name has one code point sequence), trim, lowercase.
 *  2. Reject invisible, control, whitespace and bidi-control characters.
 *  3. Reject mixed-script names that combine Latin with Cyrillic or Greek, the
 *     classic spoofing construction (UTS #39 section 5.2).
 *  4. Skeleton: map characters that are visually confusable with Latin letters
 *     onto those letters. Two usernames with the same skeleton look alike.
 *
 * The confusable table is a curated subset of the Unicode confusables data
 * (UTS #39), covering the Cyrillic and Greek letters that render like Latin
 * lowercase letters and digits. It deliberately does not fold ASCII with
 * ASCII (for example "rn" and "m", "0" and "o"), which would reject large
 * numbers of legitimate names.
 */

export const USERNAME_MAX_LENGTH = 255;

/** Code point -> Latin look-alike (all inputs are already lowercase NFKC). */
const CONFUSABLES: Readonly<Record<string, string>> = {
  // Cyrillic
  "\u0430": "a",
  "\u0432": "b",
  "\u0441": "c",
  "\u0435": "e",
  "\u04bb": "h",
  "\u0456": "i",
  "\u0458": "j",
  "\u043a": "k",
  "\u04cf": "l",
  "\u043c": "m",
  "\u043d": "h",
  "\u043e": "o",
  "\u0440": "p",
  "\u0455": "s",
  "\u0442": "t",
  "\u0443": "y",
  "\u0445": "x",
  "\u0501": "d",
  "\u051b": "q",
  "\u051d": "w",
  "\u0475": "v",
  "\u04c0": "l",
  // Greek
  "\u03b1": "a",
  "\u03b2": "b",
  "\u03b5": "e",
  "\u03b9": "i",
  "\u03ba": "k",
  "\u03bd": "v",
  "\u03bf": "o",
  "\u03c1": "p",
  "\u03c4": "t",
  "\u03c5": "u",
  "\u03c7": "x",
  "\u03b3": "y",
  // Latin look-alikes outside ASCII
  "\u0131": "i",
  "\u0261": "g",
  "\u0269": "i",
  "\u0251": "a",
  "\u1d00": "a",
  "\u1d04": "c",
  "\u1d0f": "o",
  "\u1d20": "v",
  "\u1d21": "w",
  "\u1d22": "z",
  "\u0262": "g",
  "\u029c": "h",
  "\u026a": "i",
  "\u029f": "l",
  "\u0274": "n",
  "\u0280": "r",
  // Digits and punctuation look-alikes
  "\u0660": "0",
  "\u06f0": "0",
  "\u0966": "0",
  "\u2010": "-",
  "\u2011": "-",
  "\u2212": "-",
  "\uff3f": "_",
};

const INVISIBLE_OR_CONTROL =
  /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Z}\u034f\u115f\u1160\u17b4\u17b5\u3164\uffa0]/u;

export type UsernameErrorCode =
  "empty" | "too_long" | "invalid_characters" | "mixed_script";

export class UsernameValidationError extends Error {
  constructor(
    readonly code: UsernameErrorCode,
    message: string
  ) {
    super(message);
    this.name = "UsernameValidationError";
  }
}

export interface PreparedUsername {
  /** Canonical stored form: NFKC, trimmed, lowercase. */
  username: string;
  /** Look-alike key: equal skeletons mean visually confusable names. */
  skeleton: string;
}

/** NFKC, trim, lowercase. Safe to call on any lookup input. */
export function normalizeUsername(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase().normalize("NFKC");
}

/** Maps confusable characters onto the Latin characters they imitate. */
export function usernameSkeleton(normalized: string): string {
  let skeleton = "";
  for (const char of normalized) {
    skeleton += CONFUSABLES[char] ?? char;
  }
  return skeleton.normalize("NFKC");
}

function hasScript(value: string, script: "Latin" | "Cyrillic" | "Greek") {
  return new RegExp(`\\p{Script=${script}}`, "u").test(value);
}

/**
 * Normalizes and validates a username. Throws UsernameValidationError for
 * empty, over-long, invisible-character and mixed-script names.
 */
export function prepareUsername(raw: string): PreparedUsername {
  const username = normalizeUsername(raw);

  if (username.length === 0) {
    throw new UsernameValidationError("empty", "Username is required");
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    throw new UsernameValidationError("too_long", "Username is too long");
  }
  if (INVISIBLE_OR_CONTROL.test(username)) {
    throw new UsernameValidationError(
      "invalid_characters",
      "Username contains invalid characters"
    );
  }
  if (
    hasScript(username, "Latin") &&
    (hasScript(username, "Cyrillic") || hasScript(username, "Greek"))
  ) {
    throw new UsernameValidationError(
      "mixed_script",
      "Username cannot mix Latin letters with Cyrillic or Greek letters"
    );
  }

  return { username, skeleton: usernameSkeleton(username) };
}
