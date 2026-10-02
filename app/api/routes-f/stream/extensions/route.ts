import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const extensionSchema = z.object({
    extensionId: z.string().uuid(),
    position: z.enum(["overlay", "panel"]),
    config: z.record(z.any()).default({}),
});

/**
 * GET /api/routes-f/stream/extensions
 * List enabled extensions for authenticated creator.
 */
export async function GET(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    try {
        const { rows } = await sql`
      SELECT 
        se.id, 
        se.extension_id as "extensionId", 
        se.position, 
        se.config, 
        se.is_enabled as "isEnabled",
        ec.name,
        ec.icon_url as "iconUrl"
      FROM stream_extensions se
      JOIN extension_catalog ec ON se.extension_id = ec.id
      WHERE se.user_id = ${session.userId}
      ORDER BY se.created_at DESC
    `;

        return NextResponse.json({ extensions: rows });
    } catch (error) {
        console.error("[Extensions API] Error fetching user extensions:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/routes-f/stream/extensions
 * Enable an extension for the creator.
 */
export async function POST(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    try {
        const body = await req.json();
        const result = extensionSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: "Invalid request body", details: result.error.format() }, { status: 400 });
        }

        const { extensionId, position, config } = result.data;

        // Check limits
        const { rows: counts } = await sql`
      SELECT position, COUNT(*) as count
      FROM stream_extensions
      WHERE user_id = ${session.userId} AND is_enabled = TRUE
      GROUP BY position
    `;

        const overlayCount = parseInt(counts.find(c => c.position === "overlay")?.count || "0");
        const panelCount = parseInt(counts.find(c => c.position === "panel")?.count || "0");

        if (position === "overlay" && overlayCount >= 3) {
            return NextResponse.json({ error: "Maximum of 3 overlay extensions allowed" }, { status: 400 });
        }
        if (position === "panel" && panelCount >= 2) {
            return NextResponse.json({ error: "Maximum of 2 panel extensions allowed" }, { status: 400 });
        }

        // Validate config against catalog schema
        const { rows: catalog } = await sql`
      SELECT json_schema FROM extension_catalog WHERE id = ${extensionId} LIMIT 1
    `;

        if (catalog.length === 0) {
            return NextResponse.json({ error: "Extension not found in catalog" }, { status: 404 });
        }

        // Simple schema validation (check if keys in config match schema properties if schema is simple)
        // For now, we trust the config but could add deeper validation if needed.

        const { rows: newExtension } = await sql`
      INSERT INTO stream_extensions (user_id, extension_id, position, config)
      VALUES (${session.userId}, ${extensionId}, ${position}, ${JSON.stringify(config)})
      RETURNING id, extension_id as "extensionId", position, config
    `;

        return NextResponse.json(newExtension[0], { status: 201 });
    } catch (error) {
        console.error("[Extensions API] Error enabling extension:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PATCH /api/routes-f/stream/extensions/[id]
 * Actually, the issue says PATCH /api/routes-f/stream/extensions/[id]
 * But in standard Next.js app router, this would be in a separate directory if we want [id] parameter.
 * I will handle it by checking for the id in the URL or moving it to a nested route.
 * The user specified: PATCH /api/routes-f/stream/extensions/[id]
 */
// Since we are in app/api/routes-f/stream/extensions/route.ts, we can't easily get [id] from the path without a subfolder.
// I'll create app/api/routes-f/stream/extensions/[id]/route.ts for PATCH and DELETE.
