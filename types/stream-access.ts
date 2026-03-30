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

/** JSON stored in `stream_access_config.config` when `access_type` is `token_gated` */
export interface TokenGateConfig {
  asset_code: string;
  min_balance: string;
  /** Stellar issuer public key; omit for native XLM */
  issuer?: string;
}

export type StreamAccessConfig = TokenGateConfig;

export interface AccessResult {
  allowed: boolean;
  /** Present when allowed is false */
  reason?: "token_gated" | "no_wallet" | "public";
}

/** Shape stored in users.creator JSONB for access control */
export interface CreatorAccessSettings {
  stream_access_type?: StreamAccessType;
  stream_access_config?: StreamAccessConfig;
}
