import { httpStatusOf } from "@/lib/resilience/circuit-breaker";
import { callHorizon } from "./horizon-client";

export interface NativeBalance {
  /** Native XLM balance as Horizon reports it (7 decimal places). */
  balance: string;
  /**
   * false when the account does not exist on the ledger yet: a new custodial
   * wallet stays unfunded until it first receives at least the base reserve.
   */
  activated: boolean;
}

/**
 * The account's native XLM balance, through the Horizon breaker. Throws
 * CircuitOpenError / DownstreamTimeoutError when Horizon is unavailable.
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
    return { balance: native?.balance ?? "0", activated: true };
  } catch (error) {
    if (httpStatusOf(error) === 404) {
      return { balance: "0", activated: false };
    }
    throw error;
  }
}

export const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;
