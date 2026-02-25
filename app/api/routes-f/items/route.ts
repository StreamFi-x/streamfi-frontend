import { NextResponse } from "next/server";
import { createRoutesFRecord } from "@/lib/routes-f/store";

export async function POST(req: Request) {
    let body;
    try {
        body = await req.json();
    } catch (error) {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        const newRecord = createRoutesFRecord({
            title: body.title,
            description: body.description,
            tags: body.tags,
        });

        const location = new URL(`/api/routes-f/items/${newRecord.id}`, req.url).toString();
        const headers = new Headers();
        headers.set("Location", location);

        return NextResponse.json(newRecord, { status: 201, headers });
    } catch (error: any) {
        if (error.message === "invalid-payload") {
            return NextResponse.json(
                { error: "Unprocessable Entity", message: "Missing title or description" },
                { status: 422 }
            );
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
