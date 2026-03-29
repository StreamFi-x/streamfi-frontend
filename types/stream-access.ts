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
}
