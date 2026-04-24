import { getRoutesFJob } from "@/lib/routes-f/store";
import { routesFSuccess, routesFError } from "../../../routesF/response"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  const job = getRoutesFJob(id);

  if (!job) {
    return routesFError("Job not found", 404);
  }

  return routesFSuccess(job, 200);
}
