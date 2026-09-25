import type { LedgerEntry } from "./types";

export function sortByCreatedAtDesc(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
