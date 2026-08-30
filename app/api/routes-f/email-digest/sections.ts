import type { DigestSection } from "./types";

export const VALID_SECTIONS: DigestSection[] = [
  "live_alerts",
  "new_clips",
  "tip_summary",
  "recommendations",
];

export function isValidSection(s: string): s is DigestSection {
  return (VALID_SECTIONS as string[]).includes(s);
}

export function validateSections(sections: string[]): DigestSection[] | null {
  if (!sections.every(isValidSection)) {return null;}
  return sections as DigestSection[];
}
