/**
 * Slugify a string into a URL-safe slug (#563).
 *
 * Steps:
 *  1. Normalize to NFD and strip combining diacritics (é → e)
 *  2. Remove emoji and other non-ASCII, non-alphanumeric characters
 *  3. Lowercase
 *  4. Replace whitespace / punctuation runs with the chosen separator
 *  5. Collapse consecutive separators
 *  6. Strip leading/trailing separators
 *  7. Truncate at word boundary (no mid-word cut)
 */

export type Separator = "-" | "_";

export interface SlugifyOptions {
  separator?: Separator;
  maxLength?: number;
}

const DIACRITIC_RE = /\p{M}/gu;
const EMOJI_RE = /\p{Emoji_Presentation}/gu;
const NON_WORD_RE = /[^a-z0-9]+/g;

export function slugify(text: string, options: SlugifyOptions = {}): string {
  const sep = options.separator ?? "-";
  const max = options.maxLength ?? 100;

  let s = text
    .normalize("NFD")           // decompose accented chars
    .replace(DIACRITIC_RE, "")  // strip combining marks (diacritics)
    .replace(EMOJI_RE, " ")     // replace emoji with space
    .toLowerCase()
    .replace(NON_WORD_RE, sep)  // replace non-alphanumeric runs with separator
    .replace(new RegExp(`${sep === "-" ? "-" : "_"}+`, "g"), sep) // collapse consecutive seps
    .replace(new RegExp(`^${sep}|${sep}$`, "g"), ""); // trim leading/trailing sep

  if (s.length <= max) return s;

  // Truncate at word boundary — find the last separator at or before max
  const truncated = s.slice(0, max);
  const lastSep = truncated.lastIndexOf(sep);
  return lastSep > 0 ? truncated.slice(0, lastSep) : truncated;
}
