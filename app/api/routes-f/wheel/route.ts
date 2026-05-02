import { NextRequest, NextResponse } from "next/server";

const MAX_SLICES = 1000;
const MAX_SPINS = 100;

type WheelMode = "keep" | "eliminate";

type InputSlice = string | { label?: unknown; weight?: unknown };

interface WheelSlice {
  label: string;
  weight: number;
}

interface SpinResult {
  spin: number;
  selected: WheelSlice;
  slices_remaining: number;
}

function createSeededRandom(seed: string | number) {
  let h = 2166136261;
  const input = String(seed);
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseSlices(value: unknown): WheelSlice[] | string {
  if (!Array.isArray(value)) {
    return "slices must be an array";
  }

  if (value.length < 1 || value.length > MAX_SLICES) {
    return `slices must contain between 1 and ${MAX_SLICES} entries`;
  }

  return value.map((slice: InputSlice, index): WheelSlice => {
    if (typeof slice === "string") {
      return { label: slice.trim(), weight: 1 };
    }

    if (!slice || typeof slice !== "object") {
      throw new Error(`slice at index ${index} must be a string or object`);
    }

    const label = typeof slice.label === "string" ? slice.label.trim() : "";
    const weight = slice.weight === undefined ? 1 : Number(slice.weight);

    if (!label) {
      throw new Error(`slice at index ${index} requires a label`);
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`slice at index ${index} requires weight > 0`);
    }

    return { label, weight };
  });
}

function chooseWeighted(slices: WheelSlice[], random: () => number): number {
  const totalWeight = slices.reduce((sum, slice) => sum + slice.weight, 0);
  let cursor = random() * totalWeight;

  for (let i = 0; i < slices.length; i += 1) {
    cursor -= slices[i].weight;
    if (cursor < 0) {
      return i;
    }
  }

  return slices.length - 1;
}

export async function POST(req: NextRequest) {
  let body: {
    slices?: unknown;
    spins?: unknown;
    seed?: unknown;
    mode?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let slices: WheelSlice[];
  try {
    const parsed = parseSlices(body.slices);
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }
    slices = parsed;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid slices" },
      { status: 400 }
    );
  }

  const spins = body.spins === undefined ? 1 : Number(body.spins);
  if (!Number.isInteger(spins) || spins < 1 || spins > MAX_SPINS) {
    return NextResponse.json(
      { error: `spins must be an integer between 1 and ${MAX_SPINS}` },
      { status: 400 }
    );
  }

  const mode = (body.mode ?? "keep") as WheelMode;
  if (mode !== "keep" && mode !== "eliminate") {
    return NextResponse.json(
      { error: "mode must be keep or eliminate" },
      { status: 400 }
    );
  }

  const random =
    body.seed === undefined
      ? Math.random
      : createSeededRandom(String(body.seed));
  const wheel = [...slices];
  const results: SpinResult[] = [];
  const spinCount =
    mode === "eliminate" ? Math.min(spins, wheel.length) : spins;

  for (let spin = 1; spin <= spinCount; spin += 1) {
    const selectedIndex = chooseWeighted(wheel, random);
    const selected = wheel[selectedIndex];

    if (mode === "eliminate") {
      wheel.splice(selectedIndex, 1);
    }

    results.push({
      spin,
      selected,
      slices_remaining: wheel.length,
    });
  }

  return NextResponse.json({
    results,
    total_slices_remaining: wheel.length,
  });
}
