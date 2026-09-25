// Denomination tables for supported currencies (values in smallest unit: cents/kobo)
// Stored in descending order so the greedy algorithm works correctly

export type DenominationEntry = {
  denomination: number; // face value in the currency's base unit (e.g. 100.00 for $100 bill)
  label: string;
};

export const DENOMINATION_TABLES: Record<string, DenominationEntry[]> = {
  USD: [
    { denomination: 100, label: "100 dollar bill" },
    { denomination: 50, label: "50 dollar bill" },
    { denomination: 20, label: "20 dollar bill" },
    { denomination: 10, label: "10 dollar bill" },
    { denomination: 5, label: "5 dollar bill" },
    { denomination: 1, label: "1 dollar bill" },
    { denomination: 0.25, label: "quarter" },
    { denomination: 0.10, label: "dime" },
    { denomination: 0.05, label: "nickel" },
    { denomination: 0.01, label: "penny" },
  ],
  EUR: [
    { denomination: 500, label: "500 euro note" },
    { denomination: 200, label: "200 euro note" },
    { denomination: 100, label: "100 euro note" },
    { denomination: 50, label: "50 euro note" },
    { denomination: 20, label: "20 euro note" },
    { denomination: 10, label: "10 euro note" },
    { denomination: 5, label: "5 euro note" },
    { denomination: 2, label: "2 euro coin" },
    { denomination: 1, label: "1 euro coin" },
    { denomination: 0.50, label: "50 cent coin" },
    { denomination: 0.20, label: "20 cent coin" },
    { denomination: 0.10, label: "10 cent coin" },
    { denomination: 0.05, label: "5 cent coin" },
    { denomination: 0.02, label: "2 cent coin" },
    { denomination: 0.01, label: "1 cent coin" },
  ],
  NGN: [
    { denomination: 1000, label: "1000 naira note" },
    { denomination: 500, label: "500 naira note" },
    { denomination: 200, label: "200 naira note" },
    { denomination: 100, label: "100 naira note" },
    { denomination: 50, label: "50 naira note" },
    { denomination: 20, label: "20 naira note" },
    { denomination: 10, label: "10 naira note" },
    { denomination: 5, label: "5 naira coin" },
    { denomination: 1, label: "1 naira coin" },
    { denomination: 0.50, label: "50 kobo coin" },
  ],
};

export const SUPPORTED_CURRENCIES = Object.keys(DENOMINATION_TABLES);
