/**
 * Transak on-ramp integration types.
 * Covers widget config, lifecycle events, and webhook payloads.
 *
 * Note: @transak/transak-sdk v4 takes { widgetUrl, referrer } and appends
 * all configuration as query params. The types here cover our app-level
 * config building and the data returned by events / webhooks.
 */

export type TransakCryptoCurrency = "XLM" | "USDC";
export type TransakFiatCurrency = string; // e.g. "USD", "EUR", "GBP"
export type TransakEnvironment = "STAGING" | "PRODUCTION";

export type TransakOrderStatus =
  | "AWAITING_PAYMENT_FROM_USER"
  | "PAYMENT_DONE_MARKED_BY_USER"
  | "PROCESSING"
  | "PENDING_DELIVERY_FROM_TRANSAK"
  | "ON_HOLD_PENDING_DELIVERY_FROM_TRANSAK"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "REFUNDED"
  | "EXPIRED";

/** Shape of order data included in Transak widget events */
export interface TransakOrderData {
  id: string;
  status: TransakOrderStatus;
  cryptoAmount: number | null;
  cryptoCurrency: TransakCryptoCurrency;
  fiatAmount: number;
  fiatCurrency: TransakFiatCurrency;
  walletAddress: string;
  network: string;
  transactionHash: string | null;
  isBuyOrSell: "BUY" | "SELL";
  createdAt: string;
  updatedAt: string;
  conversionPrice?: number;
  totalFeeInFiat?: number;
  partnerOrderId?: string;
  partnerCustomerId?: string;
}

/** Webhook payload from Transak (server-side) */
export interface TransakWebhookPayload {
  webhookData: {
    id: string;
    status: TransakOrderStatus;
    cryptoAmount: number | null;
    cryptoCurrency: TransakCryptoCurrency;
    fiatAmount: number;
    fiatCurrency: TransakFiatCurrency;
    walletAddress: string;
    network: string;
    transactionHash: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

/** Row stored in the transak_orders DB table */
export interface TransakOrderRow {
  id: string;
  user_id: string;
  status: TransakOrderStatus;
  crypto_amount: number | null;
  crypto_currency: TransakCryptoCurrency;
  fiat_amount: number;
  fiat_currency: TransakFiatCurrency;
  wallet_address: string;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
}
