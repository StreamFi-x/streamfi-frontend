import rates from "./rates.json";

export type RatesData = typeof rates;

export function isValidCurrency(code: string): boolean {
  return code.toUpperCase() in rates;
}

export function getRate(from: string, to: string): number {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  if (!isValidCurrency(fromUpper) || !isValidCurrency(toUpper)) {
    throw new Error(`Invalid currency code`);
  }

  const ratesTyped = rates as RatesData;
  const fromRate = ratesTyped[fromUpper as keyof RatesData];
  const toRate = ratesTyped[toUpper as keyof RatesData];

  return toRate / fromRate;
}

export function convert(from: string, to: string, amount: number): number {
  const rate = getRate(from, to);
  return Math.round(amount * rate * 100) / 100;
}

export function roundRate(rate: number): number {
  return Math.round(rate * 10000) / 10000;
}
