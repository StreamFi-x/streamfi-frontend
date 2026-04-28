import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
    position: z.enum(["overlay", "panel"]).optional(),
    config: z.record(z.any()).optional(),
    isEnabled: z.boolean().optional(),
});

/**
 * PATCH /api/routes-f/stream/extensions/[id]
 * Update extension config or position.
 */
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    const { id } = await context.params;

    try {
        const body = await req.json();
        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: "Invalid request body", details: result.error.format() }, { status: 400 });
        }

        // Check ownership
        const { rows: existing } = await sql`
      SELECT user_id FROM stream_extensions WHERE id = ${id} LIMIT 1
    `;

        if (existing.length === 0) {
            return NextResponse.json({ error: "Extension not found" }, { status: 404 });
        }

        if (existing[0].user_id !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { position, config, isEnabled } = result.data;

        // Build update query dynamically
        const updates: string[] = [];
        if (position !== undefined) {
            updates.push(`position = '${position}'`);
        }
        if (config !== undefined) {
            updates.push(`config = '${JSON.stringify(config)}'`);
        }
        if (isEnabled !== undefined) {
            updates.push(`is_enabled = ${isEnabled}`);
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        if (updates.length > 1) { // more than just updated_at
            const query = `
          UPDATE stream_extensions
          SET ${updates.join(", ")}
          WHERE id = $1
          RETURNING id, extension_id as "extensionId", position, config, is_enabled as "isEnabled"
        `;
            const { rows } = await sql.query(query, [id]);
            return NextResponse.json(rows[0]);
        }

        return NextResponse.json({ message: "No changes provided" });
    } catch (error) {
        console.error("[Extensions API] Error updating extension:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/routes-f/stream/extensions/[id]
 * Disable/Remove an extension.
 */
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    const { id } = await context.params;

    try {
        // Check ownership
        const { rows: existing } = await sql`
      SELECT user_id FROM stream_extensions WHERE id = ${id} LIMIT 1
    `;

        if (existing.length === 0) {
            return NextResponse.json({ error: "Extension not found" }, { status: 404 });
        }

        if (existing[0].user_id !== session.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await sql`
      DELETE FROM stream_extensions
      WHERE id = ${id}
    `;

        return NextResponse.json({ message: "Extension disabled" });
    } catch (error) {
        console.error("[Extensions API] Error deleting extension:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
