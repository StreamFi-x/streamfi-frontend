/**
 * Types for GET /api/routes-f/multi-asset-tips
 * and POST /api/routes-f/multi-asset-tips/convert
 */

export type AssetSymbol = "XLM" | "USDC" | "BTC" | "ETH";

export interface TipAsset {
  symbol: AssetSymbol;
  /** Current USD price for 1 unit of this asset (test/static data) */
  usd_rate: number;
  /** Minimum tip amount in this asset's native units */
  min_tip: number;
}

export interface TipAssetsResponse {
  assets: TipAsset[];
}

export interface ConvertRequest {
  amount: number;
  from: AssetSymbol;
  to: AssetSymbol;
}

export interface ConvertResponse {
  from: AssetSymbol;
  to: AssetSymbol;
  amount: number;
  converted: number;
  rate: number; // how many `to` units per 1 `from` unit
}
