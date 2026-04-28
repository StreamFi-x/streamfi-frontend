import { NextRequest, NextResponse } from "next/server";

type Unit = "metric" | "imperial";

const DISCLAIMER =
  "BMI is a screening tool and not a diagnostic measure of health.";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function getWhoCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Obesity class I";
  if (bmi < 40) return "Obesity class II";
  return "Obesity class III";
}

export async function POST(req: NextRequest) {
  let body: { weight?: unknown; height?: unknown; unit?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const weight = Number(body.weight);
  const height = Number(body.height);
  const unit = body.unit as Unit;

  if (!Number.isFinite(weight) || weight <= 0) {
    return NextResponse.json({ error: "weight must be a positive number." }, { status: 400 });
  }

  if (!Number.isFinite(height) || height <= 0) {
    return NextResponse.json({ error: "height must be a positive number." }, { status: 400 });
  }

  if (unit !== "metric" && unit !== "imperial") {
    return NextResponse.json({ error: "unit must be 'metric' or 'imperial'." }, { status: 400 });
  }

  let bmiRaw: number;
  let idealMin: number;
  let idealMax: number;
  let rangeUnit: "kg" | "lbs";

  if (unit === "metric") {
    const heightMeters = height / 100;
    const heightSquared = heightMeters * heightMeters;
    bmiRaw = weight / heightSquared;
    idealMin = 18.5 * heightSquared;
    idealMax = 24.9 * heightSquared;
    rangeUnit = "kg";
  } else {
    const heightSquared = height * height;
    bmiRaw = (703 * weight) / heightSquared;
    idealMin = (18.5 * heightSquared) / 703;
    idealMax = (24.9 * heightSquared) / 703;
    rangeUnit = "lbs";
  }

  const bmi = round1(bmiRaw);
  const category = getWhoCategory(bmiRaw);

  return NextResponse.json({
    bmi,
    category,
    ideal_weight_range: {
      min: round1(idealMin),
      max: round1(idealMax),
      unit: rangeUnit,
    },
    disclaimer: DISCLAIMER,
  });
}
