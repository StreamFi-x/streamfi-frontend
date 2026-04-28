export const DEFAULT_LOCALE = "en-US";

const FALLBACK_CURRENCIES = [
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "HKD",
  "NZD",
  "SEK",
  "KRW",
  "SGD",
  "NOK",
  "MXN",
  "INR",
  "RUB",
  "ZAR",
  "TRY",
  "BRL",
  "TWD",
  "DKK",
  "PLN",
  "THB",
  "IDR",
  "HUF",
  "CZK",
  "ILS",
  "CLP",
  "PHP",
  "AED",
  "COP",
  "SAR",
  "MYR",
  "RON",
  "NGN",
  "PKR",
  "VND",
  "EGP",
];

const SUPPORTED_CURRENCIES = new Set(
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("currency").map((code) => code.toUpperCase())
    : FALLBACK_CURRENCIES
);

export type CurrencyFormatResult = {
  formatted: string;
  currency: string;
  locale_used: string;
  symbol: string;
  code: string;
};

export function resolveLocale(locale?: string): string {
  const candidate = locale?.trim() || DEFAULT_LOCALE;
  try {
    return new Intl.NumberFormat(candidate).resolvedOptions().locale;
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE).resolvedOptions().locale;
  }
}

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.has(code.toUpperCase());
}

export function formatCurrency(input: {
  amount: number;
  currency: string;
  locale: string;
  decimals?: number;
}): CurrencyFormatResult {
  const formatter = new Intl.NumberFormat(input.locale, {
    style: "currency",
    currency: input.currency,
    ...(input.decimals !== undefined
      ? {
          minimumFractionDigits: input.decimals,
          maximumFractionDigits: input.decimals,
        }
      : {}),
  });

  const formatted = formatter.format(input.amount);
  const symbol =
    formatter.formatToParts(input.amount).find((part) => part.type === "currency")?.value ??
    input.currency;
  const localeUsed = formatter.resolvedOptions().locale;

  return {
    formatted,
    currency: input.currency,
    locale_used: localeUsed,
    symbol,
    code: input.currency,
  };
}
