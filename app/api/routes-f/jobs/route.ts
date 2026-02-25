import {
  enqueueRoutesFJob,
  isValidRoutesFJobType,
  ROUTES_F_JOB_TYPES,
} from "../_lib/jobs";

type JobRequestBody = {
  type?: unknown;
  payload?: unknown;
};

export async function POST(request: Request) {
  let body: JobRequestBody;

  try {
    body = (await request.json()) as JobRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidRoutesFJobType(body.type)) {
    return Response.json(
      {
        error: "Invalid job type",
        details: { allowedTypes: ROUTES_F_JOB_TYPES },
      },
      { status: 400 }
    );
  }

  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return Response.json({ error: "payload must be an object" }, { status: 400 });
  }

  const job = enqueueRoutesFJob(body.type, body.payload as Record<string, unknown>);

  return Response.json(
    {
      jobId: job.id,
      status: job.status,
    },
    { status: 201 }
  );
}
