import type { LedgerEntry, LedgerEntryType } from "./types";

const EARN_REASONS = ["Watched 10 minutes", "Chat message bonus", "Manual award"];
const REDEMPTION_REASONS = ["Custom Emote", "Shoutout", "Play a Song"];

function hashString(value: string): number {
  return value.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/**
 * Deterministically generates an earn/redemption ledger for a viewer/creator
 * pair so the same request always returns the same history.
 */
export function generateLedger(viewerId: string, creatorId: string): LedgerEntry[] {
  const hash = hashString(`${viewerId}:${creatorId}`);
  const entryCount = 5 + (hash % 6); // 5..10 entries
  const base = new Date("2026-01-01T00:00:00.000Z").getTime();

  let balance = 0;
  const entries: LedgerEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    const isRedemption = i > 0 && (hash + i) % 3 === 0 && balance > 0;
    const type: LedgerEntryType = isRedemption ? "redemption" : "earn";
    const amount = isRedemption
      ? Math.min(balance, 100 + ((hash + i * 7) % 400))
      : 20 + ((hash + i * 11) % 200);

    balance += type === "earn" ? amount : -amount;

    const reason =
      type === "earn"
        ? EARN_REASONS[(hash + i) % EARN_REASONS.length]
        : REDEMPTION_REASONS[(hash + i) % REDEMPTION_REASONS.length];

    entries.push({
      entry_id: `ledger_${viewerId}_${creatorId}_${i}`,
      viewer_id: viewerId,
      creator_id: creatorId,
      type,
      amount,
      reason,
      balance_after: balance,
      created_at: new Date(base + i * 3_600_000).toISOString(),
    });
  }

  return entries;
}
