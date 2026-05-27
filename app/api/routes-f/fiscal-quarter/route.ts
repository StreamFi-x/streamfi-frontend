import { NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";

export interface FiscalQuarterResult {
  quarter: number;
  fiscal_year: number;
  quarter_start: string;
  quarter_end: string;
}

/**
 * Return the fiscal quarter for a date given a configurable fiscal-year start
 * month (1 = January = calendar year). `fiscal_year` is the calendar year in
 * which the containing fiscal year begins.
 */
export function fiscalQuarter(dateStr: string, fiscalStartMonth = 1): FiscalQuarterResult {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();

  const offset = (month - fiscalStartMonth + 12) % 12; // months into the fiscal year
  const quarter = Math.floor(offset / 3) + 1;
  const fyStartYear = month >= fiscalStartMonth ? year : year - 1;

  const quarterStartMonthAbs = fiscalStartMonth - 1 + (quarter - 1) * 3;
  const start = new Date(Date.UTC(fyStartYear, quarterStartMonthAbs, 1));
  const end = new Date(Date.UTC(fyStartYear, quarterStartMonthAbs + 3, 0)); // last day of quarter

  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return {
    quarter,
    fiscal_year: fyStartYear,
    quarter_start: fmt(start),
    quarter_end: fmt(end),
  };
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  fiscal_start_month: z.coerce.number().int().min(1).max(12).optional().default(1),
});

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const result = validateQuery(searchParams, schema);
  if (result instanceof NextResponse) return result;
  const { date, fiscal_start_month } = result.data;
  return NextResponse.json(fiscalQuarter(date, fiscal_start_month));
}
