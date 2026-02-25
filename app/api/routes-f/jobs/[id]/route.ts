import { NextResponse } from "next/server";
import { getRoutesFJob } from "@/lib/routes-f/store";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const job = getRoutesFJob(id);

    if (!job) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json(job, { status: 200 });
}
