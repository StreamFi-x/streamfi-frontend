import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeJob, type IncomingDelivery } from "@/lib/jobs/execute";
import { verifyQStashSignature } from "@/lib/jobs/qstash";
import { getJob } from "@/lib/jobs/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/jobs/<name> — runs one delivery of a registered background job
 * (#1416, docs/background-jobs.md).
 *
 * Callers:
 * - QStash (schedules and dispatched jobs): the `Upstash-Signature` JWT must
 *   verify against this exact URL and body. Retries and dead-lettering
 *   follow the response status (lib/jobs/execute.ts).
 * - An operator, for a manual run: `Authorization: Bearer $CRON_SECRET`.
 *   GET does the same for jobs without a payload, so the route can also be
 *   triggered by Vercel Cron.
 *
 * Only jobs in lib/jobs/registry.ts exist here, and every payload goes
 * through the job's own validation, so a caller cannot make the endpoint do
 * arbitrary work.
 */

type RouteContext = { params: Promise<{ job: string }> };

async function handle(
  req: NextRequest,
  context: RouteContext,
  body: string
): Promise<NextResponse> {
  const { job: name } = await context.params;
  const job = getJob(name);

  const signature = req.headers.get("upstash-signature");
  let trigger: IncomingDelivery["trigger"];
  if (signature) {
    if (!job || !(await verifyQStashSignature(name, signature, body))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    trigger = "qstash";
  } else if (isAuthorizedCronRequest(req)) {
    trigger = "manual";
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!job) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = body.trim() === "" ? undefined : JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const retried = Number.parseInt(
    req.headers.get("upstash-retried") ?? "0",
    10
  );
  const execution = await executeJob(job, payload, {
    trigger,
    messageId:
      trigger === "qstash" ? req.headers.get("upstash-message-id") : null,
    retried: Number.isFinite(retried) && retried > 0 ? retried : 0,
  });

  const { result } = execution;
  return NextResponse.json(
    {
      job: job.name,
      status: execution.status,
      attempt: execution.attempt,
      max_attempts: execution.maxAttempts,
      ...(result
        ? { duration_ms: result.durationMs, metrics: result.metrics }
        : {}),
      ...(execution.error ? { error: execution.error } : {}),
    },
    { status: execution.httpStatus }
  );
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handle(req, context, await req.text());
}

export async function GET(req: NextRequest, context: RouteContext) {
  return handle(req, context, "");
}
