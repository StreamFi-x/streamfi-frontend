// Seed balances and cache for the wallet balance lookup, bundled inside this
// folder per the routesF scope constraint.

export interface WalletBalance {
  balance_xlm: number;
  balance_usdc: number;
}

export interface CachedBalance extends WalletBalance {
  cached_at: string;
}

export const TTL_SECONDS = 60;

export const SEED_BALANCES: Record<string, WalletBalance> = {
  GVIEWERALPHA: { balance_xlm: 150.5, balance_usdc: 42.1 },
  GVIEWERBETA: { balance_xlm: 12.25, balance_usdc: 0 },
  GVIEWERGAMMA: { balance_xlm: 0, balance_usdc: 310.75 },
  GVIEWERDELTA: { balance_xlm: 9999.99, balance_usdc: 1250.4 },
};

// wallet -> cached balance snapshot
export const BALANCE_CACHE: Record<string, CachedBalance> = {};

export function computeBalance(wallet: string): WalletBalance | null {
  const seed = SEED_BALANCES[wallet];
  if (!seed) {return null;}
  return { ...seed };
}

export function cacheBalance(wallet: string): CachedBalance | null {
  const balance = computeBalance(wallet);
  if (!balance) {return null;}
  const entry: CachedBalance = { ...balance, cached_at: new Date(Date.now()).toISOString() };
  BALANCE_CACHE[wallet] = entry;
  return entry;
}

export function getCached(wallet: string): CachedBalance | null {
  const entry = BALANCE_CACHE[wallet];
  if (!entry) {return null;}
  const ageSeconds = (Date.now() - new Date(entry.cached_at).getTime()) / 1000;
  if (ageSeconds >= TTL_SECONDS) {return null;}
  return entry;
}

export function remainingTtl(entry: CachedBalance): number {
  const ageSeconds = (Date.now() - new Date(entry.cached_at).getTime()) / 1000;
  return Math.max(0, Math.round(TTL_SECONDS - ageSeconds));
}
