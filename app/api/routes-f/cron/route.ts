import type { NextRequest } from "next/server";
import {
  formatCronDescription,
  getNextCronRuns,
  parseCronExpression,
  parseDateFromIso,
  type CronSchedule,
} from "./_lib/cron";

const DEFAULT_COUNT = 5;
const MAX_COUNT = 50;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: { expression?: unknown; count?: unknown; from?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const expression = typeof body?.expression === "string" ? body.expression.trim() : "";
  if (!expression) {
    return jsonResponse({ error: "'expression' is required and must be a non-empty string" }, 400);
  }

  const count = body?.count === undefined ? DEFAULT_COUNT : Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return jsonResponse({ error: `'count' must be an integer between 1 and ${MAX_COUNT}` }, 400);
  }

  const from = body?.from === undefined ? undefined : String(body.from);

  let schedule: CronSchedule;
  let fromDate: Date;
  try {
    schedule = parseCronExpression(expression);
    fromDate = parseDateFromIso(from);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Invalid cron expression" }, 400);
  }

  const next_runs = getNextCronRuns(schedule, fromDate, count);
  const description = formatCronDescription(schedule);

  return jsonResponse({ valid: true, description, next_runs });
}
