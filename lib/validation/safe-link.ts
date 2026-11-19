// Shared scheme allowlist for any URL a user supplies that may later be
// rendered as a clickable link (social links, profile links, etc.).
//
// A bare `new URL(str)` parse succeeds for javascript: and data: URIs just
// as readily as it does for http:/https:, so checking only that the URL
// parses is not sufficient validation on its own — both the place a link
// is saved AND the place it is rendered must independently check the
// scheme against this allowlist (defense in depth), since relying on
// validation-time-only checks leaves any data written before this fix,
// or written through a different code path, unprotected at render time.
const ALLOWED_URL_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** True if `value` is a syntactically valid URL using an allowed scheme. */
export function isSafeLinkUrl(value: string): boolean {
  try {
    return ALLOWED_URL_SCHEMES.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Returns `value` if it is a safe link to render as a clickable href,
 * otherwise `undefined`. Use at render time immediately before putting a
 * user-supplied URL into an `href` attribute.
 */
export function toSafeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return isSafeLinkUrl(value) ? value : undefined;
}
