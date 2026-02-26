import { NextResponse } from "next/server";
import { getRoutesFRecordById, updateRoutesFRecord } from "@/lib/routes-f/store";
import { jsonResponse } from "@/lib/routes-f/version";
import { defineSchema, validatePayload } from "../../_lib/schema";

const statusUpdateSchema = defineSchema({
    ids: { type: "string", optional: false }, // Note: our simple schema doesn't support arrays well, 
    // but validatePayload handles object/array checks at top level.
    // I'll adjust the validation logic below.
    status: { type: "string", optional: false, enum: ["active", "inactive", "archived"] as const },
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    active: ["inactive", "archived", "active"],
    inactive: ["active", "archived", "inactive"],
    archived: ["archived"], // Archived is terminal, can only "stay" archived (no-op)
};

export async function PATCH(req: Request) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Manual array check for ids since our schema helper is basic
    if (!body.ids || !Array.isArray(body.ids)) {
        return jsonResponse({ error: "Invalid request payload", details: ["Field 'ids' must be an array of strings"] }, { status: 400 });
    }

    const parsed = validatePayload({ status: body.status }, { status: statusUpdateSchema.status });
    if (!parsed.ok) {
        return jsonResponse({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
    }

    const targetStatus = body.status;
    const results: { id: string; ok: boolean; error?: string }[] = [];
    let updatedCount = 0;
    let failedCount = 0;

    for (const id of body.ids) {
        const record = getRoutesFRecordById(id);

        if (!record) {
            results.push({ id, ok: false, error: "Item not found" });
            failedCount++;
            continue;
        }

        const currentStatus = record.status || "active";
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || ["active", "inactive", "archived"];

        if (!allowed.includes(targetStatus)) {
            results.push({ id, ok: false, error: `Invalid transition from ${currentStatus} to ${targetStatus}` });
            failedCount++;
            continue;
        }

        try {
            // ETag is not required for batch updates in this implementation to simplify bulk operations,
            // but we could support it if needed. For now, we follow the "Acceptance Criteria".
            updateRoutesFRecord(id, { status: targetStatus });
            results.push({ id, ok: true });
            updatedCount++;
        } catch (e: any) {
            results.push({ id, ok: false, error: e.message || "Update failed" });
            failedCount++;
        }
    }

    const responseBody = {
        updated: updatedCount,
        failed: failedCount,
        results,
    };

    if (updatedCount > 0 && failedCount > 0) {
        return jsonResponse(responseBody, { status: 207 });
    }

    if (updatedCount === 0 && failedCount > 0) {
        return jsonResponse(responseBody, { status: 422 });
    }

    return jsonResponse(responseBody, { status: 200 });
}
