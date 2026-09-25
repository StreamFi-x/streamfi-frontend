/**
 * Safely stringifies an object for embedding inside an HTML <script> tag (such as JSON-LD).
 *
 * Browsers parsing HTML script tags do not follow JSON string literal escaping rules;
 * instead, the HTML parser scans for '</script' (case-insensitive) to terminate the block.
 * If user-controlled content (such as bio or stream title) contains '</script>', it will break out
 * of the script element and allow stored XSS.
 *
 * Replacing '<' and '>' with their Unicode escapes ('\u003c' and '\u003e') is strictly valid JSON,
 * but ensures the HTML tokenizer never encounters '<' or '>', completely preventing script breakout.
 */
export function safeJsonLdStringify(data: unknown): string {
  if (data === null || data === undefined) {
    return "";
  }
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}
