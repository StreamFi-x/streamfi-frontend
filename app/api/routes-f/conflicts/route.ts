import { NextResponse } from "next/server";
import { analyzeConflicts } from "../_lib/diff";
import { jsonResponse } from "@/lib/routes-f/version";

export async function POST(req: Request) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
        !body.base ||
        typeof body.base !== "object" ||
        !body.incoming ||
        typeof body.incoming !== "object" ||
        Array.isArray(body.base) ||
        Array.isArray(body.incoming)
    ) {
        return jsonResponse(
            {
                error: "Invalid request payload",
                details: ["Both 'base' and 'incoming' must be JSON objects"],
            },
            { status: 400 }
        );
    }

    const conflicts = analyzeConflicts(body.base, body.incoming);

    return jsonResponse({ conflicts }, { status: 200 });
}
