import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getSeedCreators, filterNewCreators } from "./helpers";
import type { NewCreatorsFeedResponse } from "./types";

// Schema — query-string values arrive as strings, so we coerce to number.
const querySchema = z.object({
  within_days: z.coerce
    .number()
    .int()
    .min(1, "within_days must be ≥ 1")
    .max(365, "within_days must be ≤ 365")
    .default(7),
  min_streams: z.coerce
    .number()
    .int()
    .min(0, "min_streams must be ≥ 0")
    .max(1000, "min_streams must be ≤ 1000")
    .default(1),
});

// Handler
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const result = validateQuery(searchParams, querySchema);
  if (result instanceof NextResponse) return result;

  const { within_days, min_streams } = result.data;
  const allCreators = getSeedCreators();
  const creators = filterNewCreators(allCreators, within_days, min_streams);

  const body: NewCreatorsFeedResponse = {
    creators,
    within_days,
    min_streams,
  };

  return NextResponse.json(body);
}
