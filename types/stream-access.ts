/**
 * Stream access types shared by `/api/streams/access/check` and token-gate helpers.
 */
export type StreamAccessType =
  | "public"
  | "paid"
  | "token_gated"
  | "password"
  | "invite";

/** JSON stored in `stream_access_config.config` when `access_type` is `token_gated` */
export interface TokenGateConfig {
  asset_code: string;
  min_balance: string;
  /** Stellar issuer public key; omit for native XLM */
  issuer?: string;
 * Types for the stream access-control system.
 * Used by lib/stream/access.ts, API routes, and UI components.
 */

export type StreamAccessType = "public" | "token_gated";

export interface TokenGateConfig {
  asset_code: string;    // Stellar asset code, max 12 chars (e.g. "STREAM")
  asset_issuer: string;  // Stellar public key of the issuing account
  min_balance: string;   // Minimum token balance required (default "1")
}

export type StreamAccessConfig = TokenGateConfig;

export interface AccessResult {
  allowed: boolean;
  /** Present when allowed is false */
  reason?: "token_gated" | "no_wallet";
}

/** Shape stored in users.creator JSONB for access control */
export interface CreatorAccessSettings {
  stream_access_type?: StreamAccessType;
  stream_access_config?: StreamAccessConfig;
}
