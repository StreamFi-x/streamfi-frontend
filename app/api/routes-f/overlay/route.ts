import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { verifyToken } from "@/lib/auth/sign-token";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const overlaySettingsSchema = z.object({
    theme: z.string().optional(),
    position: z.string().optional(),
    font_size: z.number().int().positive().optional(),
    opacity: z.number().min(0).max(1).optional(),
});

/**
 * GET /api/routes-f/overlay
 * Public endpoint (token-auth) to fetch overlay config for a creator.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const token = searchParams.get("token");

    if (!token) {
        return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Verify token
    const payload = verifyToken<{ userId: string; type: string }>(token, secret);
    if (!payload || payload.type !== "overlay") {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    try {
        const { rows } = await sql`
      SELECT theme, position, font_size as "fontSize", opacity
      FROM user_overlay_config
      WHERE user_id = ${payload.userId}
      LIMIT 1
    `;

        if (rows.length === 0) {
            // Return default settings if none exist yet
            return NextResponse.json({
                theme: "default",
                position: "bottom-right",
                fontSize: 16,
                opacity: 1.0,
                primary_color: "#ac39f2"
            });
        }

        return NextResponse.json({
            ...rows[0],
            primary_color: "#ac39f2"
        });
    } catch (error) {
        console.error("[Overlay API] Error fetching config:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PATCH /api/routes-f/overlay
 * Update overlay settings for authenticated creator.
 */
export async function PATCH(req: NextRequest) {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    try {
        const body = await req.json();
        const result = overlaySettingsSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: "Invalid request body", details: result.error.format() }, { status: 400 });
        }

        const { theme, position, font_size, opacity } = result.data;

        // Use upsert to handle new or existing config
        await sql`
      INSERT INTO user_overlay_config (user_id, theme, position, font_size, opacity, updated_at)
      VALUES (
        ${session.userId}, 
        ${theme ?? 'default'}, 
        ${position ?? 'bottom-right'}, 
        ${font_size ?? 16}, 
        ${opacity ?? 1.0},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) 
      DO UPDATE SET
        theme = COALESCE(EXCLUDED.theme, user_overlay_config.theme),
        position = COALESCE(EXCLUDED.position, user_overlay_config.position),
        font_size = COALESCE(EXCLUDED.font_size, user_overlay_config.font_size),
        opacity = COALESCE(EXCLUDED.opacity, user_overlay_config.opacity),
        updated_at = CURRENT_TIMESTAMP
    `;

        return NextResponse.json({ message: "Settings updated" });
    } catch (error) {
        console.error("[Overlay API] Error updating settings:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
