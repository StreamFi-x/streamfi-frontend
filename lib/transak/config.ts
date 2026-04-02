import type { TransakCryptoCurrency, TransakEnvironment } from "@/types/transak";

/**
 * Returns the correct Transak environment based on NEXT_PUBLIC_STELLAR_NETWORK.
 * testnet → STAGING, mainnet → PRODUCTION
 */
export function getTransakEnvironment(): TransakEnvironment {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "PRODUCTION"
    : "STAGING";
}

/**
 * The Transak widget base URLs for each environment.
 */
const TRANSAK_WIDGET_URLS: Record<TransakEnvironment, string> = {
  STAGING: "https://global-stg.transak.com",
  PRODUCTION: "https://global.transak.com",
};

interface BuildTransakUrlOptions {
  walletAddress: string;
  cryptoCurrency?: TransakCryptoCurrency;
  /** User email for pre-filling KYC fields (optional) */
  email?: string;
}

/**
 * Build the full Transak widget URL with all query parameters.
 *
 * The @transak/transak-sdk v4 accepts `{ widgetUrl, referrer }` and renders
 * an iframe. All configuration is encoded as query params in widgetUrl.
 *
 * - Defaults to XLM; pass `cryptoCurrency: "USDC"` for USDC purchases.
 * - Brand colour is the StreamFi highlight (#7C3AED — purple).
 * - apiKey must be set via NEXT_PUBLIC_TRANSAK_API_KEY.
 */
export function buildTransakWidgetUrl(options: BuildTransakUrlOptions): string {
  const { walletAddress, cryptoCurrency = "XLM", email } = options;

  const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_TRANSAK_API_KEY is not set");
  }

  const environment = getTransakEnvironment();
  const baseUrl = TRANSAK_WIDGET_URLS[environment];

  const params = new URLSearchParams({
    apiKey,
    walletAddress,
    cryptoCurrencyCode: cryptoCurrency,
    // Allow user to switch between XLM and USDC in the widget
    cryptoCurrencyList: "XLM,USDC",
    network: "stellar",
    themeColor: "7C3AED",
    defaultFiatCurrency: "USD",
    defaultFiatAmount: "50",
  });

  if (email) {
    params.set("email", email);
    params.set("isAutoFillUserData", "true");
  }

  return `${baseUrl}?${params.toString()}`;
}
