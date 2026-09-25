/**
 * GET /api/routes-f/analytics-export-csv?metric=revenue&channel_id=channel_a&days=7
 *
 * Returns a CSV of a channel's daily metric series for offline analysis.
 *
 * Query params:
 *   metric      — required. "revenue" | "viewers"
 *   channel_id  — required. The channel whose series to export.
 *   days        — optional. Restrict to the most recent N days of the
 *                 series (default: entire series). Must be a positive
 *                 integer if given.
 *
 * Response 200: text/csv, header row `date,value` then one row per day,
 *   with a Content-Disposition suggesting a filename for the download.
 *
 * Error responses:
 *   400 — missing/invalid metric, channel_id, or days
 *   404 — no series for the given metric + channel_id
 */
import { NextRequest, NextResponse } from "next/server";
import type { ExportMetric } from "./types";
import { getMetricSeries } from "./seed";
import { seriesToCsv } from "./format-csv";

const VALID_METRICS: ExportMetric[] = ["revenue", "viewers"];

function isValidMetric(value: string | null): value is ExportMetric {
  return value !== null && (VALID_METRICS as string[]).includes(value);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const metric = searchParams.get("metric");
  const channelId = searchParams.get("channel_id");
  const daysRaw = searchParams.get("days");

  if (!isValidMetric(metric)) {
    return NextResponse.json(
      { error: `metric is required and must be one of: ${VALID_METRICS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!channelId) {
    return NextResponse.json(
      { error: "channel_id is required" },
      { status: 400 }
    );
  }

  let days: number | undefined;
  if (daysRaw !== null) {
    const parsed = Number(daysRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json(
        { error: "days must be a positive integer" },
        { status: 400 }
      );
    }
    days = parsed;
  }

  const series = getMetricSeries(metric, channelId);
  if (!series) {
    return NextResponse.json(
      { error: `no ${metric} data for channel_id: ${channelId}` },
      { status: 404 }
    );
  }

  const scoped =
    days !== undefined ? { ...series, points: series.points.slice(-days) } : series;

  const csv = seriesToCsv(scoped);
  const filename = `${metric}-${channelId}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
