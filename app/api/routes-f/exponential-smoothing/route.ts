import { type NextRequest, NextResponse } from "next/server";
import { exponentialSmooth } from "./smoothing";

type SmoothingBody = {
  data?: unknown;
  alpha?: unknown;
  forecast?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: SmoothingBody;

  try {
    body = (await req.json()) as SmoothingBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { data, alpha = 0.3, forecast = 1 } = body;

  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    data.some(value => typeof value !== "number" || !Number.isFinite(value))
  ) {
    return badRequest("data must be a non-empty array of finite numbers.");
  }

  if (
    typeof alpha !== "number" ||
    !Number.isFinite(alpha) ||
    alpha <= 0 ||
    alpha >= 1
  ) {
    return badRequest("alpha must be a number in the open interval (0, 1).");
  }

  if (
    typeof forecast !== "number" ||
    !Number.isInteger(forecast) ||
    forecast < 0
  ) {
    return badRequest("forecast must be a non-negative integer.");
  }

  const result = exponentialSmooth(data, alpha, forecast);
  return NextResponse.json(result);
}
