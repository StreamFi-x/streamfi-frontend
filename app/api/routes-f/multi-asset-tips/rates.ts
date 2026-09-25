/**
 * Static test-data rates for multi-asset tip support.
 *
 * These are STATIC / MOCKED values bundled inside the folder.
 * They are NOT fetched from any live price feed.
 * In production these would be replaced by a real oracle or price API.
 */

import type { TipAsset, AssetSymbol } from "./types";

/** Supported tipping assets with static USD rates and minimum tip amounts */
export const ASSETS: TipAsset[] = [
  {
    symbol: "XLM",
    usd_rate: 0.11, // 1 XLM ≈ $0.11 USD
    min_tip: 1, // minimum 1 XLM
  },
  {
    symbol: "USDC",
    usd_rate: 1.0, // 1 USDC = $1.00 USD (stablecoin)
    min_tip: 0.5, // minimum $0.50
  },
  {
    symbol: "BTC",
    usd_rate: 67_000, // 1 BTC ≈ $67,000 USD
    min_tip: 0.000015, // ≈ $1 worth
  },
  {
    symbol: "ETH",
    usd_rate: 3_500, // 1 ETH ≈ $3,500 USD
    min_tip: 0.0003, // ≈ $1 worth
  },
];

/** Lookup map for O(1) access by symbol */
export const ASSET_MAP: Record<AssetSymbol, TipAsset> = Object.fromEntries(
  ASSETS.map((a) => [a.symbol, a])
) as Record<AssetSymbol, TipAsset>;

/**
 * Convert `amount` units of `from` into units of `to` using the static USD rates.
 * Returns the converted amount rounded to 8 decimal places.
 */
export function convert(amount: number, from: AssetSymbol, to: AssetSymbol): number {
  const usdValue = amount * ASSET_MAP[from].usd_rate;
  const converted = usdValue / ASSET_MAP[to].usd_rate;
  // Round to 8 decimal places to avoid floating-point noise
  return Math.round(converted * 1e8) / 1e8;
}

/**
 * Cross-rate: how many `to` units equal 1 `from` unit.
 */
export function crossRate(from: AssetSymbol, to: AssetSymbol): number {
  return Math.round((ASSET_MAP[from].usd_rate / ASSET_MAP[to].usd_rate) * 1e8) / 1e8;
}
