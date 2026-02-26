import { getRoutesFJob } from "@/lib/routes-f/store";
import { jsonResponse } from "@/lib/routes-f/version";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const job = getRoutesFJob(id);

    if (!job) {
        return jsonResponse({ error: "Not Found" }, { status: 404 });
    }

    return jsonResponse(job, { status: 200 });
}
