import { StrKey, Networks } from "@stellar/stellar-sdk";
import type { TierPrice } from "./types";

// Deterministic mock contract id — 32 zero bytes with byte 0 set, StrKey-encoded
// as a "C..." contract address, standing in for the deployed subscription
// contract. Matches the id used by subscription-gift / subscription-purchase-intent
// so every subscription route targets the same (mock) contract.
const CONTRACT_ID_SEED = Buffer.alloc(32, 0);
CONTRACT_ID_SEED[0] = 1;
export const SUBSCRIPTION_CONTRACT_ID = StrKey.encodeContract(CONTRACT_ID_SEED);

export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const tierPrices: Record<string, TierPrice> = {
  tier_alpha_basic: {
    tier_id: "tier_alpha_basic",
    name: "Basic",
    price_usdc: 5,
  },
  tier_alpha_premium: {
    tier_id: "tier_alpha_premium",
    name: "Premium",
    price_usdc: 15,
  },
  tier_beta_basic: {
    tier_id: "tier_beta_basic",
    name: "Supporter",
    price_usdc: 8,
  },
};

export function getTierPrice(tierId: string): TierPrice | undefined {
  return tierPrices[tierId];
}
