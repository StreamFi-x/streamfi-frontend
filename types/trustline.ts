/**
 * Trustline Management Types
 * 
 * Types for Stellar trustline operations and validation
 */

import { Asset } from "@stellar/stellar-sdk";

/**
 * Status of trustline verification for an asset
 */
export type TrustlineVerificationStatus = "exists" | "missing" | "checking" | "error";

/**
 * Result of checking trustline status for a given asset
 */
export interface TrustlineCheckResult {
  publicKey: string;
  asset: Asset;
  hasTrustline: boolean;
  error?: string;
  network: "testnet" | "mainnet";
}

/**
 * Request to build a trustline creation transaction
 */
export interface BuildTrustlineTransactionRequest {
  publicKey: string;
  asset: Asset;
  network: "testnet" | "mainnet";
  memo?: string;
  feeStroops?: number;
}

/**
 * Response from trustline transaction endpoint
 */
export interface WalletTrustlineResponse {
  transaction: string; // XDR encoded
  publicKey: string;
  assetCode: string;
  assetIssuer: string;
  networkPassphrase: string;
  fee: string; // in XLM
  network: "testnet" | "mainnet";
}

/**
 * Trustline validation result for payment
 */
export interface TrustlineValidationResult {
  canProceed: boolean;
  needsTrustline: boolean;
  assetCode: string;
  error?: string;
  suggestedAction?: "create_trustline" | "none";
}

/**
 * Multi-asset payment validation including trustline checks
 */
export interface MultiAssetPaymentValidation {
  senderTrustlineValid: boolean;
  recipientTrustlineValid: boolean;
  senderAsset: Asset;
  recipientAsset: Asset;
  errors: string[];
  canProceed: boolean;
}
