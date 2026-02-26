import {
  enqueueRoutesFJob,
  isValidRoutesFJobType,
  ROUTES_F_JOB_TYPES,
} from "../_lib/jobs";
import { jsonResponse } from "@/lib/routes-f/version";

type JobRequestBody = {
  type?: unknown;
  payload?: unknown;
};

export async function POST(request: Request) {
  let body: JobRequestBody;

  try {
    body = (await request.json()) as JobRequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidRoutesFJobType(body.type)) {
    return jsonResponse(
      {
        error: "Invalid job type",
        details: { allowedTypes: ROUTES_F_JOB_TYPES },
      },
      { status: 400 }
    );
  }

  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return jsonResponse({ error: "payload must be an object" }, { status: 400 });
  }

  const job = enqueueRoutesFJob(body.type, body.payload as Record<string, unknown>);

  return jsonResponse(
    {
      jobId: job.id,
      status: job.status,
    },
    { status: 201 }
  );
}
