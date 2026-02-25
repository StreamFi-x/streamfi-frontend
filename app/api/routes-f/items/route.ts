import { NextResponse } from "next/server";
import { listRoutesFRecords } from "@/lib/routes-f/store";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;

    const cursor = url.searchParams.get("cursor") || undefined;
    const status = url.searchParams.get("status") || "active";

    try {
        const result = listRoutesFRecords({ limit, cursor, status });
        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
