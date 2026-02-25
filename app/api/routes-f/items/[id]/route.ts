import { NextResponse } from "next/server";
import { getRoutesFRecordById, updateRoutesFRecord, deleteRoutesFRecord } from "@/lib/routes-f/store";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    // Validate ID format (must start with rf-)
    if (!id.startsWith("rf-")) {
        return NextResponse.json(
            { error: "Bad Request", message: "Invalid ID format" },
            { status: 400 }
        );
    }

    const deleted = deleteRoutesFRecord(id);

    if (!deleted) {
        return NextResponse.json(
            { error: "Not Found", message: "Item not found" },
            { status: 404 }
        );
    }

    return new Response(null, { status: 204 });
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    // Handle both Next.js 14 and 15+ param formats
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const ifMatch = req.headers.get("if-match");
    if (!ifMatch) {
        return NextResponse.json(
            { error: "Precondition Required", message: "If-Match header is missing" },
            { status: 428 }
        );
    }

    let updates;
    try {
        updates = await req.json();
    } catch (error) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const updated = updateRoutesFRecord(id, updates, ifMatch);

        if (!updated) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        const headers = new Headers();
        if (updated.etag) {
            headers.set("ETag", updated.etag);
        }

        return NextResponse.json(updated, { status: 200, headers });
    } catch (e: any) {
        if (e.message === "ETAG_MISMATCH") {
            return NextResponse.json(
                { error: "Precondition Failed", message: "ETag mismatch" },
                { status: 412 }
            );
        }
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> | { id: string } }
) {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const record = getRoutesFRecordById(id);
    if (!record) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const headers = new Headers();
    const etag = record.etag || `"${record.updatedAt || record.createdAt}"`;
    headers.set("ETag", etag);

    return NextResponse.json(record, { status: 200, headers });
}
