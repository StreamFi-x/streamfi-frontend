import type { CountryInfo } from "../types";

export function findByCodeOrName(data: CountryInfo[], code: string | null, name: string | null) {
  if (!code && !name) {
    return data;
  }

  if (code) {
    const normalized = code.trim().toUpperCase();
    return data.find(
      (country) =>
        country.alpha2.toUpperCase() === normalized ||
        country.alpha3.toUpperCase() === normalized ||
        country.numeric === normalized
    );
  }

  const normalizedName = (name ?? "").trim().toLowerCase();
  return data.find((country) => country.name.toLowerCase().includes(normalizedName));
}
