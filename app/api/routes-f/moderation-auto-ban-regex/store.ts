import type { AutoBanRegexConfig, AutoBanRegexPattern } from "./types";

/**
 * In-memory store keyed by creator_id.
 * Exported so tests can reset between runs.
 */
export const autoBanRegexStore = new Map<string, AutoBanRegexConfig>();

/** Seed data — one creator with pre-existing auto-ban patterns. */
const SEED: AutoBanRegexConfig[] = [
  {
    creator_id: "creator_001",
    patterns: [
      {
        pattern: "^spam_bot_\\d+$",
        flags: "i",
        note: "Blocks the spam_bot_### handle family",
        created_at: "2026-06-20T10:00:00Z",
      },
      {
        pattern: "free.?nft.?giveaway",
        flags: "i",
        note: "Common phishing handle pattern",
        created_at: "2026-06-21T09:15:00Z",
      },
    ],
    updated_at: "2026-06-21T09:15:00Z",
  },
];

function cloneConfig(entry: AutoBanRegexConfig): AutoBanRegexConfig {
  return { ...entry, patterns: entry.patterns.map((p) => ({ ...p })) };
}

function seedStore(): void {
  autoBanRegexStore.clear();
  for (const entry of SEED) {
    autoBanRegexStore.set(entry.creator_id, cloneConfig(entry));
  }
}

seedStore();

export function resetStore(): void {
  seedStore();
}

export function getConfig(creatorId: string): AutoBanRegexConfig | undefined {
  return autoBanRegexStore.get(creatorId);
}

export function putConfig(
  creatorId: string,
  patterns: AutoBanRegexPattern[],
  now: number = Date.now()
): AutoBanRegexConfig {
  const entry: AutoBanRegexConfig = {
    creator_id: creatorId,
    patterns,
    updated_at: new Date(now).toISOString(),
  };
  autoBanRegexStore.set(creatorId, entry);
  return entry;
}
