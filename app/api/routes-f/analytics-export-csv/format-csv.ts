import type { MetricSeries } from "./types";

/**
 * Escapes a single CSV field per RFC 4180: wraps in double quotes and
 * doubles any embedded quote if the value contains a comma, quote, or
 * newline. Values here are always dates/numbers so this is a defensive
 * baseline rather than a load-bearing requirement.
 */
function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes a metric's daily series to CSV: a header row (`date,value`)
 * followed by one row per point, in the order given. Uses CRLF line
 * endings per RFC 4180.
 */
export function seriesToCsv(series: MetricSeries): string {
  const rows = [["date", "value"], ...series.points.map((p) => [p.date, p.value])];
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
