import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export interface CountryInfo {
  country: string;
  continent: string;
  region: string;
}

// ISO 3166-1 alpha-2 -> continent/region. Bundled in-folder (representative
// subset across all continents; extend as needed).
const COUNTRIES: Record<string, CountryInfo> = {
  NG: { country: "Nigeria", continent: "Africa", region: "Western Africa" },
  ZA: { country: "South Africa", continent: "Africa", region: "Southern Africa" },
  EG: { country: "Egypt", continent: "Africa", region: "Northern Africa" },
  KE: { country: "Kenya", continent: "Africa", region: "Eastern Africa" },
  US: { country: "United States", continent: "North America", region: "Northern America" },
  CA: { country: "Canada", continent: "North America", region: "Northern America" },
  MX: { country: "Mexico", continent: "North America", region: "Central America" },
  BR: { country: "Brazil", continent: "South America", region: "South America" },
  AR: { country: "Argentina", continent: "South America", region: "South America" },
  GB: { country: "United Kingdom", continent: "Europe", region: "Northern Europe" },
  DE: { country: "Germany", continent: "Europe", region: "Western Europe" },
  FR: { country: "France", continent: "Europe", region: "Western Europe" },
  ES: { country: "Spain", continent: "Europe", region: "Southern Europe" },
  IT: { country: "Italy", continent: "Europe", region: "Southern Europe" },
  RU: { country: "Russia", continent: "Europe", region: "Eastern Europe" },
  CN: { country: "China", continent: "Asia", region: "Eastern Asia" },
  JP: { country: "Japan", continent: "Asia", region: "Eastern Asia" },
  IN: { country: "India", continent: "Asia", region: "Southern Asia" },
  SG: { country: "Singapore", continent: "Asia", region: "South-Eastern Asia" },
  AE: { country: "United Arab Emirates", continent: "Asia", region: "Western Asia" },
  SA: { country: "Saudi Arabia", continent: "Asia", region: "Western Asia" },
  AU: { country: "Australia", continent: "Oceania", region: "Australia and New Zealand" },
  NZ: { country: "New Zealand", continent: "Oceania", region: "Australia and New Zealand" },
  FJ: { country: "Fiji", continent: "Oceania", region: "Melanesia" },
  AQ: { country: "Antarctica", continent: "Antarctica", region: "Antarctica" },
};

/** Look up continent/region for an ISO alpha-2 country code (case-insensitive). */
export function lookupContinent(code: string): CountryInfo | null {
  return COUNTRIES[code.trim().toUpperCase()] ?? null;
}

const schema = z.object({ code: z.string() });

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const info = lookupContinent(result.data.code);
  if (!info) {
    return NextResponse.json(
      { error: `unknown country code: ${result.data.code}` },
      { status: 404 },
    );
  }
  return NextResponse.json(info);
}
