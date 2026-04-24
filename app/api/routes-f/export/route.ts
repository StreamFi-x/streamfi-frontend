import {
  applyCacheHeaders,
  buildCacheKey,
  getCachedEntry,
  isCacheEnabled,
  setCachedEntry,
} from "@/lib/routes-f/cache";
import { recordMetric } from "@/lib/routes-f/metrics";
import { getRoutesFRecords } from "@/lib/routes-f/store";
import { applyRateLimitHeaders, checkRateLimit } from "@/lib/routes-f/rate-limit";
import { routesFSuccess, routesFError } from "../../routesF/response";

const CSV_HEADERS = [
  "id",
  "title",
  "description",
  "tags",
  "createdAt",
  "updatedAt",
];

function toCsvValue(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function recordsToCsv(records: ReturnType<typeof getRoutesFRecords>) {
  const rows = [CSV_HEADERS.join(",")];

  records.forEach((record) => {
    const values = [
      record.id,
      record.title,
      record.description,
      record.tags.join("|"),
      record.createdAt,
      record.updatedAt || "",
    ];
    rows.push(values.map((value) => toCsvValue(String(value))).join(","));
  });

  return rows.join("\n");
}

export async function GET(req: Request) {
  const limiter = checkRateLimit({
    headers: req.headers,
    routeKey: "routes-f/export",
  });

  const headers = new Headers();
  applyRateLimitHeaders(headers, limiter);

  if (!limiter.allowed) {
    headers.set("Retry-After", String(limiter.retryAfterSeconds));
    return routesFError("Rate limit exceeded", 429, headers);
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const selectedFormat = format === "csv" ? "csv" : "json";

  recordMetric("export");

  const cacheEnabled = isCacheEnabled();
  const cacheKey = buildCacheKey("routes-f/export", {
    format: selectedFormat,
  });

  if (cacheEnabled) {
    const cached = getCachedEntry(cacheKey);
    if (cached) {
      applyCacheHeaders(headers, "HIT", true);
      headers.set("Content-Type", cached.contentType);
      headers.set(
        "Content-Disposition",
        `attachment; filename="routes-f-export.${selectedFormat}"`
      );
      return new Response(cached.body, { status: 200, headers });
    }
  }

  const records = getRoutesFRecords();
  let body: string;
  let contentType = "application/json";

  if (selectedFormat === "csv") {
    body = recordsToCsv(records);
    contentType = "text/csv";
  } else {
    body = JSON.stringify(records);
    contentType = "application/json";
  }

  if (cacheEnabled) {
    setCachedEntry(cacheKey, body, contentType);
    applyCacheHeaders(headers, "MISS", true);
  } else {
    applyCacheHeaders(headers, "MISS", false);
  }

  headers.set("Content-Type", contentType);
  headers.set(
    "Content-Disposition",
    `attachment; filename="routes-f-export.${selectedFormat}"`
  );

  // Return JSON response with apiVersion only if format is JSON
  if (selectedFormat === "json") {
    const parsedBody = JSON.parse(body);
    return routesFSuccess(parsedBody, 200, headers);
  }

  // For CSV, return raw CSV body
  return new Response(body, { status: 200, headers });
}