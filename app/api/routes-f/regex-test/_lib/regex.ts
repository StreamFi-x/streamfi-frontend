import { MatchResult } from "../types";

export function testRegex(
  pattern: string,
  flags: string = "",
  input: string
): { valid: boolean; matches: MatchResult[] } {
  try {
    const regex = new RegExp(pattern, flags);
    const matches: MatchResult[] = [];
    let match;

    // Limit iterations to prevent potential DoS
    let iterations = 0;
    const maxIterations = 100000;

    while (
      (match = regex.exec(input)) !== null &&
      matches.length < 10000 &&
      iterations++ < maxIterations
    ) {
      const groups = match.slice(1).map(g => g || "");
      const named_groups: Record<string, string> = {};

      if (match.groups) {
        for (const [key, value] of Object.entries(match.groups)) {
          named_groups[key] = value || "";
        }
      }

      matches.push({
        match: match[0],
        index: match.index,
        groups,
        named_groups,
      });

      if (!regex.global) break;

      // Prevent infinite loop in zero-width matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    return { valid: true, matches };
  } catch (error) {
    return { valid: false, matches: [] };
  }
}
