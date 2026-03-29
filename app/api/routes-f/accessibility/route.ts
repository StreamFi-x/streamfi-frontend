import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureRoutesFSchema } from "@/app/api/routes-f/_lib/schema";

const accessibilitySchema = z.object({
    captions_enabled: z.boolean(),
    caption_font_size: z.enum(["small", "medium", "large"]),
    high_contrast: z.boolean(),
    reduce_motion: z.boolean(),
    screen_reader_hints: z.boolean(),
    autoplay: z.boolean(),
});

const partialAccessibilitySchema = accessibilitySchema.partial();

type AccessibilitySettings = z.infer<typeof accessibilitySchema>;

const DEFAULT_SETTINGS: AccessibilitySettings = {
    captions_enabled: true,
    caption_font_size: "medium",
    high_contrast: false,
    reduce_motion: false,
    screen_reader_hints: true,
    autoplay: false,
};

function setAccessibilityHeaders(response: NextResponse, settings: AccessibilitySettings) {
    response.headers.set("X-Accessibility-Captions", settings.captions_enabled ? "on" : "off");
    response.headers.set("X-Accessibility-Font-Size", settings.caption_font_size);
    response.headers.set("X-Accessibility-High-Contrast", settings.high_contrast ? "on" : "off");
    response.headers.set("X-Accessibility-Reduce-Motion", settings.reduce_motion ? "on" : "off");
    response.headers.set("X-Accessibility-Reader-Hints", settings.screen_reader_hints ? "on" : "off");
    response.headers.set("X-Accessibility-Autoplay", settings.autoplay ? "on" : "off");
    return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    try {
        await ensureRoutesFSchema();

        const { rows } = await sql`
      SELECT 
        captions_enabled,
        caption_font_size,
        high_contrast,
        reduce_motion,
        screen_reader_hints,
        autoplay
      FROM accessibility_settings
      WHERE user_id = ${session.userId}
    `;

        const settings = rows.length > 0 ? (rows[0] as AccessibilitySettings) : DEFAULT_SETTINGS;

        const response = NextResponse.json(settings);
        return setAccessibilityHeaders(response, settings);
    } catch (error) {
        console.error("[accessibility] GET error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
    const session = await verifySession(req);
    if (!session.ok) {
        return session.response;
    }

    const bodyResult = await validateBody(req, partialAccessibilitySchema);
    if (bodyResult instanceof Response) {
        return bodyResult;
    }

    const updates = bodyResult.data;

    try {
        await ensureRoutesFSchema();

        // Fetch current settings to merge or just use defaults for missing keys
        const { rows: currentRows } = await sql`
      SELECT * FROM accessibility_settings WHERE user_id = ${session.userId}
    `;

        const current = currentRows.length > 0 ? (currentRows[0] as AccessibilitySettings) : DEFAULT_SETTINGS;
        const merged = { ...current, ...updates };

        const { rows } = await sql`
      INSERT INTO accessibility_settings (
        user_id,
        captions_enabled,
        caption_font_size,
        high_contrast,
        reduce_motion,
        screen_reader_hints,
        autoplay,
        updated_at
      )
      VALUES (
        ${session.userId},
        ${merged.captions_enabled},
        ${merged.caption_font_size},
        ${merged.high_contrast},
        ${merged.reduce_motion},
        ${merged.screen_reader_hints},
        ${merged.autoplay},
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        captions_enabled = EXCLUDED.captions_enabled,
        caption_font_size = EXCLUDED.caption_font_size,
        high_contrast = EXCLUDED.high_contrast,
        reduce_motion = EXCLUDED.reduce_motion,
        screen_reader_hints = EXCLUDED.screen_reader_hints,
        autoplay = EXCLUDED.autoplay,
        updated_at = now()
      RETURNING *
    `;

        const updatedSettings = rows[0] as AccessibilitySettings;
        const response = NextResponse.json(updatedSettings);
        return setAccessibilityHeaders(response, updatedSettings);
    } catch (error) {
        console.error("[accessibility] PATCH error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
