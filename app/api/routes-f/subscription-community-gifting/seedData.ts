import { StrKey, Networks } from "@stellar/stellar-sdk";
import type { TierPrice } from "./types";

// Deterministic mock contract id — 32 zero bytes with byte 0 set, StrKey-encoded
// as a "C..." contract address, standing in for the deployed subscription
// contract. Matches the id used by the other subscription routes so every
// subscription route targets the same (mock) contract.
const CONTRACT_ID_SEED = Buffer.alloc(32, 0);
CONTRACT_ID_SEED[0] = 1;
export const SUBSCRIPTION_CONTRACT_ID = StrKey.encodeContract(CONTRACT_ID_SEED);

export const NETWORK_PASSPHRASE = Networks.TESTNET;

// Upper bound on a single community-gifting call, so one request can't try to
// gift the entire channel at once.
export const MAX_GIFT_COUNT = 100;

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

// Active chatters per creator, ordered by most-recent chat activity first.
// "the next N active chatters" == the first N of this list, after skipping
// anyone who already holds an active subscription to that creator.
export const activeChattersByCreator: Record<string, string[]> = {
  creator_alpha: [
    "viewer_nova",
    "viewer_pixel",
    "viewer_quill",
    "viewer_rune",
    "viewer_sage",
    "viewer_tide",
    "viewer_umbra",
  ],
  creator_beta: ["viewer_wren", "viewer_yarn"],
  // A creator whose chat is currently empty.
  creator_gamma: [],
};

// Chatters who already have an active sub to the creator and must be skipped so
// a community gift isn't wasted on them.
export const existingSubscribersByCreator: Record<string, string[]> = {
  creator_alpha: ["viewer_pixel"],
};

export function getCreatorChatters(creatorId: string): string[] | undefined {
  return activeChattersByCreator[creatorId];
}

// The ordered list of chatters eligible to receive a community gift sub:
// active chatters minus anyone already subscribed. Returns undefined when the
// creator is unknown (has no chatter list at all).
export function getEligibleChatters(creatorId: string): string[] | undefined {
  const chatters = activeChattersByCreator[creatorId];
  if (!chatters) {
    return undefined;
  }
  const subscribed = new Set(existingSubscribersByCreator[creatorId] ?? []);
  return chatters.filter(c => !subscribed.has(c));
}
