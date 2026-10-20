/**
 * Stellar Reserve Calculation Utilities
 *
 * Stellar requires every account to maintain a minimum reserve consisting of:
 * - Base reserve: typically 2 XLM (can be updated by network governance)
 * - Per-entry reserve: typically 0.5 XLM per trustline, offer, signer, etc.
 *
 * The total spendable balance = raw balance - (base reserve + entry count * per-entry reserve)
 *
 * See: https://developers.stellar.org/docs/glossary/minimum-balance
 */

import { Horizon } from "@stellar/stellar-sdk";
import { logger } from "@/lib/tracing/logger";

/**
 * Stellar network reserve parameters (in stroops, where 1 XLM = 10,000,000 stroops)
 * These are the current standard values but can be updated by network governance.
 * Most recent change was in the Stellar protocol, though these have been stable.
 */
const BASE_RESERVE_STROOPS = 2_000_000; // 2 XLM in stroops
const PER_ENTRY_RESERVE_STROOPS = 500_000; // 0.5 XLM in stroops

/**
 * Calculate the minimum reserve requirement for an account based on its current state.
 *
 * @param account - Stellar account object from Horizon, containing balances and entry counts
 * @returns Total reserve requirement in stroops
 *
 * The reserve includes:
 * - Base reserve (always required)
 * - Per-entry reserves for:
 *   - Trustlines (one per non-native asset)
 *   - Open offers (one per active trade offer)
 *   - Signers (additional signing keys beyond the primary key)
 *   - Data entries (custom key-value data stored on the account)
 *   - Claimable balances (if the account is a claimant)
 *
 * Note: The account object from Horizon includes subentry_count which includes
 * trustlines, offers, signers, and data entries. We use this for the calculation.
 */
export function calculateMinimumReserveStroops(account: Horizon.AccountResponse): number {
  // subentry_count includes trustlines, offers, signers, data entries, sponsorships
  const subentryCount = account.subentry_count || 0;
  const totalReserve = BASE_RESERVE_STROOPS + subentryCount * PER_ENTRY_RESERVE_STROOPS;
  return totalReserve;
}

/**
 * Convert stroops to XLM (7 decimal places as used by Stellar/Horizon).
 * @param stroops - Amount in stroops
 * @returns Amount in XLM as a string with 7 decimal places
 */
function stroopsToXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
}

/**
 * Convert XLM to stroops.
 * @param xlm - Amount in XLM
 * @returns Amount in stroops
 */
function xlmToStroops(xlm: string | number): number {
  return Math.floor(parseFloat(String(xlm)) * 10_000_000);
}

/**
 * Calculate the spendable balance (raw balance minus reserve requirement).
 *
 * This is the actual amount a user can send from their account, accounting
 * for the Stellar minimum reserve that must always be maintained.
 *
 * @param account - Stellar account object from Horizon
 * @returns Spendable balance in XLM as a string with 7 decimal places
 *
 * Edge cases:
 * - If the account's balance is less than the reserve, returns "0" (no spendable funds)
 * - This correctly handles accounts with zero trustlines (still need base reserve)
 * - Automatically accounts for additional reserves when trustlines are added/removed
 */
export function calculateSpendableBalance(account: Horizon.AccountResponse): string {
  try {
    const nativeBalance = account.balances.find(b => b.asset_type === "native");
    if (!nativeBalance) {
      logger.warn("Account has no native balance", { accountId: account.id });
      return "0";
    }

    const rawBalanceStroops = xlmToStroops(nativeBalance.balance);
    const reserveStroops = calculateMinimumReserveStroops(account);
    const spendableStroops = Math.max(0, rawBalanceStroops - reserveStroops);

    return stroopsToXlm(spendableStroops);
  } catch (error) {
    logger.error("Failed to calculate spendable balance", {
      error: error instanceof Error ? error.message : String(error),
      accountId: account?.id,
    });
    // On error, return "0" to be conservative (fail safe)
    return "0";
  }
}

/**
 * Get both raw and spendable balance information for display.
 *
 * Useful when the UI wants to show transparency about reserve requirements.
 */
export interface BalanceInfo {
  /** Raw balance as reported by Horizon */
  raw: string;
  /** Amount available after reserve is subtracted */
  spendable: string;
  /** Minimum reserve requirement */
  reserve: string;
  /** Number of subentries (trustlines, offers, signers, etc.) */
  subentryCount: number;
}

/**
 * Get comprehensive balance information for an account.
 *
 * @param account - Stellar account object from Horizon
 * @returns BalanceInfo object with raw, spendable, and reserve amounts
 */
export function getBalanceInfo(account: Horizon.AccountResponse): BalanceInfo {
  const nativeBalance = account.balances.find(b => b.asset_type === "native");
  const rawBalance = nativeBalance?.balance ?? "0";
  const reserveStroops = calculateMinimumReserveStroops(account);

  return {
    raw: rawBalance,
    spendable: calculateSpendableBalance(account),
    reserve: stroopsToXlm(reserveStroops),
    subentryCount: account.subentry_count || 0,
  };
}
