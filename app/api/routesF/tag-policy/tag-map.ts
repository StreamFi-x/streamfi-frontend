import { TagCategory } from "./types";

/**
 * Tag -> category map bundled in-folder so the policy check needs no
 * external tag taxonomy service.
 */
export const TAG_TO_CATEGORY: Record<string, TagCategory> = {
  // family
  "family-friendly": "family",
  wholesome: "family",
  "kid-safe": "family",
  cozy: "family",

  // gaming
  gaming: "gaming",
  speedrun: "gaming",
  "retro-gaming": "gaming",
  minecraft: "gaming",
  soulslike: "gaming",

  // esports
  esports: "esports",
  tournament: "esports",
  ranked: "esports",
  scrims: "esports",

  // music
  music: "music",
  "dj-set": "music",
  "live-band": "music",
  karaoke: "music",
  producing: "music",

  // irl
  irl: "irl",
  "just-chatting": "irl",
  travel: "irl",
  cooking: "irl",
  fitness: "irl",

  // crypto
  crypto: "crypto",
  stellar: "crypto",
  soroban: "crypto",
  defi: "crypto",
  "trading-desk": "crypto",

  // education
  education: "education",
  tutorial: "education",
  workshop: "education",
  "study-with-me": "education",

  // art
  art: "art",
  "digital-art": "art",
  "pixel-art": "art",
  animation: "art",

  // tech
  tech: "tech",
  "software-dev": "tech",
  hardware: "tech",
  "security-research": "tech",

  // mature
  mature: "mature",
  "18-plus": "mature",
  gambling: "mature",
  "strong-language": "mature",
  horror: "mature",
};

/**
 * Normalize a raw tag ("Just Chatting", " GAMING ") into map-key form.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

export function categoryForTag(tag: string): TagCategory | null {
  return TAG_TO_CATEGORY[normalizeTag(tag)] ?? null;
}
