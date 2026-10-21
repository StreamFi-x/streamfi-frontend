import { httpStatusOf } from "@/lib/resilience/circuit-breaker";
import { callHorizon } from "./horizon-client";
import { calculateSpendableBalance } from "./reserve";

export interface NativeBalance {
  /** Native XLM balance as Horizon reports it (7 decimal places). */
  balance: string;
  /**
   * Spendable balance after subtracting Stellar's minimum reserve requirement.
   * This is the actual amount the user can spend from their account.
   * For zero-trustline accounts, this is raw balance minus ~2 XLM (base reserve).
   */
  spendableBalance: string;
  /**
   * false when the account does not exist on the ledger yet: a new custodial
   * wallet stays unfunded until it first receives at least the base reserve.
   */
  activated: boolean;
}

/**
 * The account's native XLM balance, through the Horizon breaker. Throws
 * CircuitOpenError / DownstreamTimeoutError when Horizon is unavailable.
 * 
 * Returns both raw balance and spendable balance (after reserve deduction).
 */
export async function getNativeBalance(
  address: string
): Promise<NativeBalance> {
  try {
    const account = await callHorizon(server =>
      server.accounts().accountId(address).call()
    );
    const native = (
      account.balances as { asset_type: string; balance: string }[]
    ).find(b => b.asset_type === "native");
    return {
      balance: native?.balance ?? "0",
      spendableBalance: calculateSpendableBalance(account),
      activated: true,
    };
  } catch (error) {
    if (httpStatusOf(error) === 404) {
      return { balance: "0", spendableBalance: "0", activated: false };
    }
    throw error;
  }
}

export const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;
