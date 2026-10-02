import { DENOMINATION_TABLES, DenominationEntry } from "./denominations";

export type BreakdownItem = {
  denomination: number;
  label: string;
  count: number;
};

export type BreakdownResult = {
  breakdown: BreakdownItem[];
  total_pieces: number;
};

/**
 * Breaks an amount into the fewest bills/coins using a greedy algorithm.
 * Uses cent-precision (rounds to 2 decimal places to avoid floating-point drift).
 */
export function breakdownAmount(amount: number, currency: string): BreakdownResult {
  const table: DenominationEntry[] = DENOMINATION_TABLES[currency];
  const breakdown: BreakdownItem[] = [];

  // Work in integer cents to avoid floating-point issues
  let remaining = Math.round(amount * 100);

  for (const entry of table) {
    const denomCents = Math.round(entry.denomination * 100);
    if (remaining <= 0) {break;}
    if (denomCents > remaining) {continue;}

    const count = Math.floor(remaining / denomCents);
    remaining -= count * denomCents;
    breakdown.push({ denomination: entry.denomination, label: entry.label, count });
  }

  const total_pieces = breakdown.reduce((sum, item) => sum + item.count, 0);
  return { breakdown, total_pieces };
}
