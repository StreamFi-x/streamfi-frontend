import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  x: z.array(z.number()).min(3, "x must have at least 3 elements"),
  y: z.array(z.number()).min(3, "y must have at least 3 elements"),
});

type Strength = "weak" | "moderate" | "strong";
type Direction = "positive" | "negative" | "none";

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  return num / Math.sqrt(denomX * denomY);
}

function strength(abs: number): Strength {
  if (abs >= 0.7) return "strong";
  if (abs >= 0.3) return "moderate";
  return "weak";
}

function direction(coefficient: number): Direction {
  if (coefficient > 0) return "positive";
  if (coefficient < 0) return "negative";
  return "none";
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { x, y } = parsed.data;

  if (x.length !== y.length) {
    return NextResponse.json(
      { error: "x and y must have equal length" },
      { status: 400 }
    );
  }

  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  const varX = x.reduce((s, v) => s + (v - meanX) ** 2, 0);
  const varY = y.reduce((s, v) => s + (v - meanY) ** 2, 0);

  if (varX === 0 || varY === 0) {
    return NextResponse.json(
      { error: "Zero-variance series: all values are identical" },
      { status: 400 }
    );
  }

  const coefficient = pearson(x, y);
  const abs = Math.abs(coefficient);

  return NextResponse.json({
    coefficient: Math.round(coefficient * 1e10) / 1e10,
    strength: strength(abs),
    direction: direction(coefficient),
    n,
  });
}
