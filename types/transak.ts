// Matches the actual @transak/transak-sdk v4 TransakConfig type
export interface TransakConfig {
  widgetUrl: string; // Full URL with all params as query string
  referrer: string; // Your app's origin, e.g. "https://streamfi.xyz"
  widgetWidth?: string;
  widgetHeight?: string;
  containerId?: string;
  themeColor?: string;
}

// Parameters that get baked into the widgetUrl query string
export interface TransakWidgetParams {
  apiKey: string;
  network: TransakNetwork;
  cryptoCurrencyCode?: TransakCryptoCurrency;
  walletAddress?: string;
  disableWalletAddressForm?: boolean;
  fiatAmount?: number;
  fiatCurrency?: string;
  email?: string;
  themeColor?: string; // hex without #
  environment?: TransakEnvironment;
}

export type TransakEnvironment = "STAGING" | "PRODUCTION";

export type TransakNetwork = "stellar";

export type TransakCryptoCurrency = "XLM" | "USDC";

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

export interface TransakOrderData {
  id: string;
  status: TransakOrderStatus;
  cryptoAmount: number;
  cryptoCurrency: TransakCryptoCurrency;
  fiatAmount: number;
  fiatCurrency: string;
  network: TransakNetwork;
  walletAddress: string;
  paymentOptionId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  transactionHash?: string;
}

export interface TransakEventPayload {
  eventName: string;
  status: TransakOrderData;
}
