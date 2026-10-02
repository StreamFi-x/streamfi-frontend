import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routes-f/extensions/catalog
 * Returns all active extensions available for streamers.
 */
export async function GET() {
    try {
        const { rows } = await sql`
      SELECT id, name, description, json_schema as "jsonSchema", icon_url as "iconUrl"
      FROM extension_catalog
      WHERE is_active = TRUE
      ORDER BY name ASC
    `;

        return NextResponse.json({
            extensions: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("[Catalog API] Error fetching extensions:", error);
        return NextResponse.json(
            { error: "Failed to fetch extension catalog" },
            { status: 500 }
        );
    }
}
