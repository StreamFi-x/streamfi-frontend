/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import type { BreakEvenRequest, BreakEvenResponse } from "./types";

const schema = z.object({
  fixed_costs: z.number(),
  price_per_unit: z.number(),
  variable_cost_per_unit: z.number(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {
    return result;
  }

  const { fixed_costs, price_per_unit, variable_cost_per_unit } = result.data;

  if (price_per_unit <= variable_cost_per_unit) {
    return NextResponse.json(
      { error: "Price must exceed variable cost per unit to break even" },
      { status: 400 }
    );
  }

  const contribution_margin = price_per_unit - variable_cost_per_unit;
  const break_even_units = Math.ceil(fixed_costs / contribution_margin);
  const break_even_revenue = break_even_units * price_per_unit;

  const response: BreakEvenResponse = {
    break_even_units,
    break_even_revenue,
    contribution_margin,
  };

  return NextResponse.json(response);
}
