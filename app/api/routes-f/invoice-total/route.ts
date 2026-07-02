import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const lineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

const schema = z.object({
  items: z.array(lineItemSchema).nonempty(),
  tax_percent: z.number().nonnegative().optional(),
  discount_percent: z.number().nonnegative().optional(),
});

export interface LineItemInput {
  description: string;
  qty: number;
  unit_price: number;
}

export interface InvoiceTotalResult {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  line_totals: number[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeInvoiceTotal(
  items: LineItemInput[],
  taxPercent?: number,
  discountPercent?: number
): InvoiceTotalResult {
  const lineTotals = items.map((item) => round2(item.qty * item.unit_price));
  const subtotal = round2(lineTotals.reduce((sum, t) => sum + t, 0));

  const discount = discountPercent ? round2(subtotal * (discountPercent / 100)) : 0;
  const taxable = round2(subtotal - discount);
  const tax = taxPercent ? round2(taxable * (taxPercent / 100)) : 0;
  const total = round2(taxable + tax);

  return { subtotal, discount, taxable, tax, total, line_totals: lineTotals };
}

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { items, tax_percent, discount_percent } = result.data;
  return NextResponse.json(computeInvoiceTotal(items, tax_percent, discount_percent));
}
