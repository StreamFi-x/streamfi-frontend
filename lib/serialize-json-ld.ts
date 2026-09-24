/**
 * Serialize a value for embedding inside <script type="application/ld+json">
 * via dangerouslySetInnerHTML.
 *
 * JSON.stringify alone does not escape "</script>" (or "<!--"), so a
 * user-controlled string can break out of the JSON-LD block and inject
 * executable HTML/JS. Escaping "<" to a JSON unicode escape keeps the
 * payload valid JSON while neutralizing script/ HTML breakouts.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
