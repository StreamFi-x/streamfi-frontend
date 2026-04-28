import { NextRequest, NextResponse } from "next/server";
import { formatCurrency, isSupportedCurrency, resolveLocale } from "./_lib/formatter";

type CurrencyFormatRequest = {
  amount?: unknown;
  currency?: unknown;
  locale?: unknown;
  decimals?: unknown;
};

export async function POST(request: NextRequest) {
  let body: CurrencyFormatRequest;
  try {
    body = (await request.json()) as CurrencyFormatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { amount, currency, locale, decimals } = body ?? {};

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json(
      { error: '"amount" is required and must be a finite number' },
      { status: 400 }
    );
  }

  if (typeof currency !== "string" || currency.trim() === "") {
    return NextResponse.json(
      { error: '"currency" is required and must be a non-empty string' },
      { status: 400 }
    );
  }

  if (locale !== undefined && typeof locale !== "string") {
    return NextResponse.json({ error: '"locale" must be a string' }, { status: 400 });
  }

  if (
    decimals !== undefined &&
    (typeof decimals !== "number" ||
      !Number.isInteger(decimals) ||
      decimals < 0 ||
      decimals > 20)
  ) {
    return NextResponse.json(
      { error: '"decimals" must be an integer between 0 and 20' },
      { status: 400 }
    );
  }

  const code = currency.toUpperCase();
  if (!isSupportedCurrency(code)) {
    return NextResponse.json({ error: `Unsupported currency code: ${code}` }, { status: 400 });
  }

  const localeUsed = resolveLocale(locale);
  const result = formatCurrency({
    amount,
    currency: code,
    locale: localeUsed,
    decimals: decimals as number | undefined,
  });

  return NextResponse.json(result, { status: 200 });
}
