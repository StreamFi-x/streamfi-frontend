/**
 * Safe JSON-LD serialization utility.
 *
 * Prevents stored and reflected XSS when serializing objects inside
 * <script type="application/ld+json"> tags.
 *
 * Standard JSON.stringify does NOT escape HTML characters or </script> tags.
 * If user-controlled strings (e.g. user.bio, stream title) contain </script>,
 * an HTML parser closes the script tag prematurely and executes arbitrary markup
 * or subsequent <script> elements.
 *
 * This function escapes:
 * - '<' to '\u003c' (neutralizes any opening tags, closing tags, comments, CDATA)
 * - '>' to '\u003e'
 * - '&' to '\u0026'
 * - U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR)
 *
 * Valid JSON and Schema.org parsers decode unicode escapes (\u003c) natively,
 * preserving exact data fidelity while rendering safely inside HTML.
 */
export function safeJsonLd(data: unknown): string {
  if (data === null || data === undefined) {
    return "";
  }

  const jsonString = typeof data === "string" ? data : JSON.stringify(data);

  return jsonString
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
