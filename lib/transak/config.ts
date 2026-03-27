import type {
  TransakConfig,
  TransakEnvironment,
  TransakWidgetParams,
} from "@/types/transak";

// Widget base URLs
const TRANSAK_WIDGET_URLS: Record<TransakEnvironment, string> = {
  STAGING: "https://global-stg.transak.com",
  PRODUCTION: "https://global.transak.com",
};

// Mirror Stellar network setting — testnet → STAGING, mainnet → PRODUCTION
export const TRANSAK_ENVIRONMENT: TransakEnvironment =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "PRODUCTION"
    : "STAGING";

/**
 * Build a Transak v4 config for StreamFi.
 *
 * In v4, all payment parameters (apiKey, walletAddress, network, etc.)
 * are baked into the widgetUrl as query params. The TransakConfig object
 * itself only contains widget display options.
 *
 * @throws if NEXT_PUBLIC_TRANSAK_API_KEY is not set
 */
export function buildTransakConfig(
  walletAddress: string,
  paramOverrides: Partial<TransakWidgetParams> = {}
): TransakConfig {
  const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_TRANSAK_API_KEY is not configured. " +
        "Add it to your .env.local file."
    );
  }

  const environment = TRANSAK_ENVIRONMENT;
  const baseUrl = TRANSAK_WIDGET_URLS[environment];

  const params: TransakWidgetParams = {
    apiKey,
    network: "stellar",
    cryptoCurrencyCode: "XLM",
    walletAddress,
    disableWalletAddressForm: true,
    themeColor: "ac39f2", // StreamFi brand purple (no #)
    environment,
    ...paramOverrides,
  };

  // Build query string — omit undefined values
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString();

  const referrer =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "https://streamfi.xyz");

  return {
    widgetUrl: `${baseUrl}?${query}`,
    referrer,
    themeColor: "#ac39f2",
  };
}
