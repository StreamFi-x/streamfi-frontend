import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type ForecastMonth = {
  month: string;
  projected_mrr_usdc: number;
};

type MrrForecastResponse = {
  current_mrr_usdc: number;
  forecast: ForecastMonth[];
};

const FORECAST_MONTHS = 3;

const querySchema = z.object({
  creator_id: z.string().min(1),
});

type MonthlyMrrPoint = {
  month: string;
  mrr_usdc: number;
};

// Seed monthly MRR bundled inside the folder (scope constraint): last 3
// months of subscription MRR per creator, most recent last.
const SEED_MONTHLY_MRR: Record<string, MonthlyMrrPoint[]> = {
  "creator-1": [
    { month: "2024-04", mrr_usdc: 1000 },
    { month: "2024-05", mrr_usdc: 1150 },
    { month: "2024-06", mrr_usdc: 1300 },
  ],
  "creator-2": [
    { month: "2024-04", mrr_usdc: 500 },
    { month: "2024-05", mrr_usdc: 480 },
    { month: "2024-06", mrr_usdc: 460 },
  ],
};

function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + 1, 1));
  const nextYear = date.getUTCFullYear();
  const nextM = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextM}`;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<MrrForecastResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);

  const validation = querySchema.safeParse({
    creator_id: searchParams.get("creator_id") ?? undefined,
  });

  if (!validation.success) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const { creator_id } = validation.data;
  const history = SEED_MONTHLY_MRR[creator_id];

  if (!history || history.length === 0) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const current = sorted[sorted.length - 1];

  // Average month-over-month delta across the trailing history, used to
  // project forward. With only 1 data point the trend is flat (0 delta).
  let totalDelta = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalDelta += sorted[i].mrr_usdc - sorted[i - 1].mrr_usdc;
  }
  const avgDelta = sorted.length > 1 ? totalDelta / (sorted.length - 1) : 0;

  const forecast: ForecastMonth[] = [];
  let projected = current.mrr_usdc;
  let month = current.month;
  for (let i = 0; i < FORECAST_MONTHS; i++) {
    month = nextMonth(month);
    projected = Math.max(0, Math.round(projected + avgDelta));
    forecast.push({ month, projected_mrr_usdc: projected });
  }

  return NextResponse.json({
    current_mrr_usdc: current.mrr_usdc,
    forecast,
  });
}
