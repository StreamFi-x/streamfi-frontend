import type { AwardRecord } from "./types";

let awardCounter = 1;

export const awardStore: AwardRecord[] = [];

// balance key is `${viewer_id}:${creator_id}`
const balances = new Map<string, number>([
  ["viewer_alice:creator_a", 500],
  ["viewer_bob:creator_a", 0],
  ["viewer_alice:creator_b", 1200],
]);

function balanceKey(viewerId: string, creatorId: string): string {
  return `${viewerId}:${creatorId}`;
}

export function getBalance(viewerId: string, creatorId: string): number {
  return balances.get(balanceKey(viewerId, creatorId)) ?? 0;
}

export function awardPoints(
  moderatorId: string,
  viewerId: string,
  creatorId: string,
  amount: number,
  reason: string
): { award: AwardRecord; new_balance: number } {
  const key = balanceKey(viewerId, creatorId);
  const newBalance = getBalance(viewerId, creatorId) + amount;
  balances.set(key, newBalance);

  const award: AwardRecord = {
    award_id: `award_${String(awardCounter++).padStart(4, "0")}`,
    moderator_id: moderatorId,
    viewer_id: viewerId,
    creator_id: creatorId,
    amount,
    reason,
    created_at: new Date().toISOString(),
  };
  awardStore.push(award);

  return { award, new_balance: newBalance };
}
