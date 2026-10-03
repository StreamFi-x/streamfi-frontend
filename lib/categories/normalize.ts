/**
 * Normalizes a proposed category name for duplicate/near-duplicate detection
 * (#1429): case, accents, and punctuation/whitespace variants collapse to the
 * same key so "Speedrunning", "Speed Running" and "speed-running" are all
 * recognized as the same request rather than three separate categories.
 *
 * This is intentionally coarser than a display title — it is a lookup key,
 * never shown to users.
 */
export function normalizeCategoryKey(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ""); // drop spaces, punctuation, symbols
}
