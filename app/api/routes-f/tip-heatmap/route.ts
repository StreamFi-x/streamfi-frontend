import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SeedTip {
  creator_id: string;
  amount_usdc: number;
  ts: string; // ISO 8601
}

function buildSeedTips(): SeedTip[] {
  const tips: SeedTip[] = [];
  const now = Date.now();
  const creators = ["creator-1", "creator-2"];
  for (let i = 0; i < 200; i++) {
    tips.push({
      creator_id: creators[i % 2],
      amount_usdc: Number((1 + (i % 20) * 0.5).toFixed(2)),
      ts: new Date(now - i * 3600 * 1000).toISOString(),
    });
  }
  return tips;
}

export const SEED_TIPS: SeedTip[] = buildSeedTips();

// Known creator timezones
const CREATOR_TIMEZONES: Record<string, string> = {
  "creator-1": "America/New_York",
  "creator-2": "Europe/London",
};

export function buildHeatmap(
  tips: SeedTip[],
  creator_id: string,
  timezone: string
): number[][] {
  // matrix[day][hour] — day 0=Sunday
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  for (const tip of tips) {
    if (tip.creator_id !== creator_id) {
      continue;
    }

    const date = new Date(tip.ts);
    // Use Intl to get local day-of-week and hour in creator's timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(date);

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";

    const day = weekdayMap[weekdayStr] ?? 0;
    const hour = parseInt(hourStr, 10) % 24;

    matrix[day][hour] = Number((matrix[day][hour] + tip.amount_usdc).toFixed(2));
  }

  return matrix;
}

/**
 * GET /api/routes-f/tip-heatmap?creator_id=...
 * Returns a 7x24 matrix of USDC tip totals bucketed by day-of-week and hour-of-day
 * in the creator's local timezone.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const creator_id = searchParams.get("creator_id");

  if (!creator_id) {
    return NextResponse.json({ error: "creator_id is required" }, { status: 400 });
  }

  const timezone = CREATOR_TIMEZONES[creator_id] ?? "UTC";
  const matrix = buildHeatmap(SEED_TIPS, creator_id, timezone);

  return NextResponse.json({ creator_id, timezone, heatmap: matrix });
}
