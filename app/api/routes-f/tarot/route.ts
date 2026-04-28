import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { drawTarotCards } from "./_lib/helpers";

const requestSchema = z.object({
  count: z.number().min(1).max(10).optional(),
  spread: z.enum(["single", "three-card", "celtic-cross"]).optional(),
  seed: z.string().optional(),
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

    const { count, spread, seed } = parsed.data;

    const result = drawTarotCards({
      count: count || 1,
      spread: spread || "single",
      seed,
    });

    const response = {
      spread: result.spread,
      cards: result.cards.map(card => ({
        position: card.position,
        name: card.name,
        suit: card.suit,
        orientation: card.orientation,
        meaning: card.meaning,
      })),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
