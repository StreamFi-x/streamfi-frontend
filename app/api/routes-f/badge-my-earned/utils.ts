import type { EarnedBadgeRecord, EarnedBadgeEntry } from "./types";

export function toEarnedEntry(record: EarnedBadgeRecord): EarnedBadgeEntry {
  const { badge_id, creator_id, creator_name, name, image_url, earned_at } =
    record;
  return { badge_id, creator_id, creator_name, name, image_url, earned_at };
}

export function sortByEarnedAtDesc(
  records: EarnedBadgeRecord[]
): EarnedBadgeRecord[] {
  return [...records].sort(
    (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
  );
}
