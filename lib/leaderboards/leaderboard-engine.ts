export interface TipEvent {
  id: string;
  senderId: string;
  recipientId: string;
  amountXlm: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  totalXlm: number;
  isFlaggedGaming: boolean;
  gamingReason?: string;
}

/**
 * Detects circular tipping / wash-trading collusion loops ($A \to B \to A$).
 */
export function detectTipCollusion(tips: TipEvent[]): Set<string> {
  const flaggedUsers = new Set<string>();
  const tipPairs = new Map<string, number>();

  for (const tip of tips) {
    // 1. Direct Self-Tipping
    if (tip.senderId === tip.recipientId) {
      flaggedUsers.add(tip.senderId);
      continue;
    }

    // 2. Circular tip tracking
    const pairKey = `${tip.senderId}->${tip.recipientId}`;
    const reverseKey = `${tip.recipientId}->${tip.senderId}`;

    tipPairs.set(pairKey, (tipPairs.get(pairKey) || 0) + tip.amountXlm);

    const reverseVolume = tipPairs.get(reverseKey) || 0;
    const forwardVolume = tipPairs.get(pairKey) || 0;

    // If accounts send >80% back and forth in high volumes
    if (reverseVolume > 50 && forwardVolume > 50) {
      const ratio = Math.min(forwardVolume, reverseVolume) / Math.max(forwardVolume, reverseVolume);
      if (ratio > 0.8) {
        flaggedUsers.add(tip.senderId);
        flaggedUsers.add(tip.recipientId);
      }
    }
  }

  return flaggedUsers;
}

/**
 * Computes top tippers leaderboard with anti-gaming exclusions.
 */
export function computeTopTippers(
  tips: TipEvent[],
  timeWindowMs: number
): LeaderboardEntry[] {
  const now = Date.now();
  const windowTips = tips.filter((t) => now - t.timestamp <= timeWindowMs);
  const collusionUsers = detectTipCollusion(windowTips);

  const totals = new Map<string, number>();
  for (const tip of windowTips) {
    totals.set(tip.senderId, (totals.get(tip.senderId) || 0) + tip.amountXlm);
  }

  const entries: LeaderboardEntry[] = Array.from(totals.entries())
    .map(([userId, totalXlm]) => ({
      rank: 0,
      userId,
      totalXlm,
      isFlaggedGaming: collusionUsers.has(userId),
      gamingReason: collusionUsers.has(userId) ? 'Circular wash-tipping detected' : undefined,
    }))
    .filter((e) => !e.isFlaggedGaming) // Exclude gamed records from public leaderboard
    .sort((a, b) => b.totalXlm - a.totalXlm)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  return entries;
}
