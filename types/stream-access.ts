/**
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
