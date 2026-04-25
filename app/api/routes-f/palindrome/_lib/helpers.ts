export function normalize(
  text: string,
  ignoreCase: boolean,
  ignorePunct: boolean,
  ignoreWhitespace: boolean
): string {
  let s = text;
  if (ignoreCase) s = s.toLowerCase();
  if (ignorePunct) s = s.replace(/[^a-zA-Z0-9\s]/g, "");
  if (ignoreWhitespace) s = s.replace(/\s+/g, "");
  return s;
}

export function isPalindrome(normalized: string): boolean {
  const reversed = normalized.split("").reverse().join("");
  return normalized === reversed;
}
