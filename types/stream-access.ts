/**
 * Stream access types shared by `/api/streams/access/check` and token-gate helpers.
 * Used by lib/stream/access.ts, API routes, and UI components.
 */

export type StreamAccessType =
  | "public"
  | "paid"
  | "token_gated"
  | "password"
  | "invite";

/**
 * Token-gate configuration stored in access-control JSON payloads.
 * Some callers still read/write `asset_issuer`, while newer helpers use `issuer`.
 * We support both to keep the type compatible with the current codebase.
 */
export interface TokenGateConfig {
  asset_code: string;
  min_balance: string;
  issuer?: string;
  /** Stellar issuer public key; omit for native XLM */
  asset_issuer?: string;
}

export type StreamAccessConfig = TokenGateConfig;

export interface AccessResult {
  allowed: boolean;
  /** Present when allowed is false */
  reason?: "token_gated" | "no_wallet" | "public";
}

export interface CreatorAccessSettings {
  stream_access_type?: StreamAccessType;
  stream_access_config?: StreamAccessConfig;
}
