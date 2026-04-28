import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateTip } from "./_lib/helpers";

const requestSchema = z.object({
  subtotal: z.number().min(0, "Subtotal must be >= 0"),
  tip_percent: z.number().min(0, "Tip percent must be >= 0").max(100, "Tip percent must be <= 100"),
  people: z.number().min(1, "People must be >= 1").optional(),
  round: z.enum(["none", "up", "nearest"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subtotal, tip_percent, people = 1, round = "none" } = parsed.data;

    const result = calculateTip({
      subtotal,
      tipPercent: tip_percent,
      people,
      round,
    });

    const response: any = {
      tip: result.tip,
      total: result.total,
      per_person: {
        tip: result.perPerson.tip,
        total: result.perPerson.total,
      },
    };

    if (result.roundedTotal !== undefined) {
      response.rounded_total = result.roundedTotal;
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
