import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  data: z.array(z.number()).min(1, "data must contain at least one number"),
  value: z.number(),
});

function getPercentileRank(data: number[], value: number) {
  const countBelow = data.filter(entry => entry < value).length;
  const countEqual = data.filter(entry => entry === value).length;

  if (countEqual === 0 && value > Math.max(...data)) {
    return {
      percentileRank: 100,
      countBelow: data.length,
      countEqual: 0,
    };
  }

  if (countEqual === 0 && value < Math.min(...data)) {
    return {
      percentileRank: 0,
      countBelow: 0,
      countEqual: 0,
    };
  }

  return {
    percentileRank: ((countBelow + 0.5 * countEqual) / data.length) * 100,
    countBelow,
    countEqual,
  };
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map(issue => ({
          field: issue.path.join(".") || "body",
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const { data, value } = parsed.data;
  const result = getPercentileRank(data, value);

  return NextResponse.json({
    percentile_rank: Number(result.percentileRank.toFixed(2)),
    count_below: result.countBelow,
    count_equal: result.countEqual,
  });
}
