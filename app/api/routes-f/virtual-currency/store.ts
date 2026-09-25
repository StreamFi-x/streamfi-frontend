import type {
  BitsPackage,
  BitsBalance,
  BitsLedgerEntry,
  CheerEvent,
  CreatorEarnings,
  PayoutBatch,
  AccountDispositionResult,
} from "./types";

export const BITS_PACKAGES: BitsPackage[] = [
  { id: "pkg_100", name: "Handful of Bits", bits: 100, price_usd: 1.4, badge: "Starter" },
  { id: "pkg_500", name: "Pouch of Bits", bits: 500, price_usd: 7.0, badge: "Popular" },
  { id: "pkg_1500", name: "Chest of Bits", bits: 1500, price_usd: 19.99, discount_percent: 5, badge: "Best Value" },
  { id: "pkg_5000", name: "Vault of Bits", bits: 5000, price_usd: 64.99, discount_percent: 8, badge: "Super Fan" },
  { id: "pkg_10000", name: "Whale Cache", bits: 10000, price_usd: 124.99, discount_percent: 12, badge: "Ultimate" },
];

export const BITS_TO_USD_CREATOR_RATE = 0.01; // 100 bits = $1.00 payout to creator
export const MIN_PAYOUT_BITS = 1000; // Minimum 1000 bits ($10) for creator payout

let txCounter = 1;
let cheerCounter = 1;
let payoutCounter = 1;

export const userBalances = new Map<string, BitsBalance>();
export const creatorEarnings = new Map<string, CreatorEarnings>();
export const ledgerEntries: BitsLedgerEntry[] = [];
export const cheerEvents: CheerEvent[] = [];
export const payoutBatches: PayoutBatch[] = [];

export function resetVirtualCurrencyStore() {
  txCounter = 1;
  cheerCounter = 1;
  payoutCounter = 1;
  userBalances.clear();
  creatorEarnings.clear();
  ledgerEntries.length = 0;
  cheerEvents.length = 0;
  payoutBatches.length = 0;

  // Seed default viewer
  const defaultViewerId = "user_alice";
  userBalances.set(defaultViewerId, {
    user_id: defaultViewerId,
    available_bits: 750,
    lifetime_purchased: 1000,
    lifetime_spent: 250,
    updated_at: new Date().toISOString(),
  });
}

// Initial seed
resetVirtualCurrencyStore();

export function getOrCreateBalance(userId: string): BitsBalance {
  let b = userBalances.get(userId);
  if (!b) {
    b = {
      user_id: userId,
      available_bits: 0,
      lifetime_purchased: 0,
      lifetime_spent: 0,
      updated_at: new Date().toISOString(),
    };
    userBalances.set(userId, b);
  }
  return b;
}

export function getOrCreateEarnings(creatorId: string): CreatorEarnings {
  let e = creatorEarnings.get(creatorId);
  if (!e) {
    e = {
      creator_id: creatorId,
      accumulated_bits: 0,
      equivalent_usd: 0,
      total_paid_out_usd: 0,
      updated_at: new Date().toISOString(),
    };
    creatorEarnings.set(creatorId, e);
  }
  return e;
}

export function purchaseBits(
  userId: string,
  packageId: string,
  paymentTxHash: string
): { success: boolean; package?: BitsPackage; balance?: BitsBalance; error?: string } {
  const pkg = BITS_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    return { success: false, error: "Invalid bits package selected" };
  }

  const balance = getOrCreateBalance(userId);
  balance.available_bits += pkg.bits;
  balance.lifetime_purchased += pkg.bits;
  balance.updated_at = new Date().toISOString();

  const entry: BitsLedgerEntry = {
    id: `tx_${String(txCounter++).padStart(5, "0")}`,
    user_id: userId,
    type: "purchase",
    amount: pkg.bits,
    balance_after: balance.available_bits,
    reference_id: paymentTxHash,
    notes: `Purchased package ${pkg.name} (${pkg.bits} bits)`,
    created_at: new Date().toISOString(),
  };

  ledgerEntries.push(entry);
  return { success: true, package: pkg, balance };
}

function getCheerBadgeTier(amount: number): string {
  if (amount >= 5000) {
    return "diamond";
  }
  if (amount >= 1000) {
    return "emerald";
  }
  if (amount >= 100) {
    return "purple";
  }
  return "bronze";
}

export function cheerBits(
  viewerId: string,
  creatorId: string,
  amountBits: number,
  message?: string
): { success: boolean; event?: CheerEvent; remaining_bits?: number; error?: string } {
  if (amountBits <= 0 || !Number.isInteger(amountBits)) {
    return { success: false, error: "Amount must be a positive integer" };
  }

  const balance = getOrCreateBalance(viewerId);
  if (balance.available_bits < amountBits) {
    return {
      success: false,
      error: `Insufficient bits balance. You have ${balance.available_bits} bits, but attempted to cheer ${amountBits} bits.`,
    };
  }

  // 1. Atomic deduction from viewer
  balance.available_bits -= amountBits;
  balance.lifetime_spent += amountBits;
  balance.updated_at = new Date().toISOString();

  // 2. Atomic credit to creator earnings
  const earnings = getOrCreateEarnings(creatorId);
  earnings.accumulated_bits += amountBits;
  earnings.equivalent_usd = +(earnings.accumulated_bits * BITS_TO_USD_CREATOR_RATE).toFixed(2);
  earnings.updated_at = new Date().toISOString();

  const cheerId = `cheer_${String(cheerCounter++).padStart(5, "0")}`;
  const nowIso = new Date().toISOString();

  // 3. Double-entry ledger
  const debitEntry: BitsLedgerEntry = {
    id: `tx_${String(txCounter++).padStart(5, "0")}`,
    user_id: viewerId,
    type: "cheer",
    amount: -amountBits,
    balance_after: balance.available_bits,
    reference_id: cheerId,
    notes: `Cheered ${amountBits} bits to creator ${creatorId}`,
    created_at: nowIso,
  };
  ledgerEntries.push(debitEntry);

  // 4. Create cheer event
  const event: CheerEvent = {
    cheer_id: cheerId,
    viewer_id: viewerId,
    creator_id: creatorId,
    amount_bits: amountBits,
    badge_tier: getCheerBadgeTier(amountBits),
    message,
    created_at: nowIso,
  };
  cheerEvents.push(event);

  return {
    success: true,
    event,
    remaining_bits: balance.available_bits,
  };
}

export function aggregateCreatorPayout(
  creatorId: string,
  destinationWallet?: string
): { success: boolean; batch?: PayoutBatch; error?: string } {
  const earnings = getOrCreateEarnings(creatorId);

  if (earnings.accumulated_bits < MIN_PAYOUT_BITS) {
    return {
      success: false,
      error: `Minimum payout threshold is ${MIN_PAYOUT_BITS} bits ($${(MIN_PAYOUT_BITS * BITS_TO_USD_CREATOR_RATE).toFixed(2)}). Current balance: ${earnings.accumulated_bits} bits ($${earnings.equivalent_usd}).`,
    };
  }

  const bitsToRedeem = earnings.accumulated_bits;
  const payoutAmountUsd = earnings.equivalent_usd;

  earnings.accumulated_bits = 0;
  earnings.equivalent_usd = 0;
  earnings.total_paid_out_usd += payoutAmountUsd;
  earnings.updated_at = new Date().toISOString();

  const batch: PayoutBatch = {
    payout_id: `payout_${String(payoutCounter++).padStart(4, "0")}`,
    creator_id: creatorId,
    bits_redeemed: bitsToRedeem,
    amount_usd: payoutAmountUsd,
    destination_wallet: destinationWallet || "G_CREATOR_DEFAULT_STELLAR_ADDRESS",
    status: "completed",
    created_at: new Date().toISOString(),
  };

  payoutBatches.push(batch);

  return { success: true, batch };
}

export function handleAccountDeletionDisposition(userId: string): AccountDispositionResult {
  const balance = userBalances.get(userId);
  if (!balance || balance.available_bits === 0) {
    return {
      user_id: userId,
      unused_bits: 0,
      status: "zero_balance",
      message: "Account has 0 bits balance. Safe to close.",
    };
  }

  const unused = balance.available_bits;
  balance.available_bits = 0;
  balance.updated_at = new Date().toISOString();

  const entry: BitsLedgerEntry = {
    id: `tx_${String(txCounter++).padStart(5, "0")}`,
    user_id: userId,
    type: "account_closure_disposition",
    amount: -unused,
    balance_after: 0,
    reference_id: `closure_${userId}`,
    notes: `Account closed with ${unused} unused bits balance disposed per platform terms`,
    created_at: new Date().toISOString(),
  };
  ledgerEntries.push(entry);

  return {
    user_id: userId,
    unused_bits: unused,
    status: "refund_processed",
    message: `Account closed. ${unused} unused bits queued for refund or disposition per policy.`,
  };
}
