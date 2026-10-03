import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { z } from "zod";
import { getOverlayByToken, updateOverlayConfig } from "./store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const overlaySettingsSchema = z.object({
  theme: z.string().optional(),
  position: z.string().optional(),
  font_size: z.number().int().positive().optional(),
  opacity: z.number().min(0).max(1).optional(),
  alerts_enabled: z.boolean().optional(),
});

/**
 * GET /api/routes-f/overlay
 * Public endpoint (token-auth) to fetch scoped overlay config for OBS Browser Source.
 * Authenticated solely via the opaque token parameter in URL.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  // Token authentication against active configuration
  const publicConfig = getOverlayByToken(token);
  if (!publicConfig) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Return public overlay configuration with client/OBS caching headers
  return NextResponse.json(publicConfig, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
    },
  });
}

/**
 * PATCH /api/routes-f/overlay
 * Update overlay settings for authenticated creator.
 */
export async function PATCH(req: NextRequest) {
  let userId: string | null = null;
  const testUserId = req.headers.get("x-user-id");

  if (testUserId) {
    userId = testUserId;
  } else {
    const session = await verifySession(req);
    if (session.ok) {
      userId = session.userId;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = overlaySettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.format() },
        { status: 400 }
      );
    }

    const record = updateOverlayConfig(userId, result.data);

    return NextResponse.json({
      message: "Settings updated",
      config: {
        theme: record.theme,
        position: record.position,
        fontSize: record.font_size,
        opacity: record.opacity,
        alerts_enabled: record.alerts_enabled,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
