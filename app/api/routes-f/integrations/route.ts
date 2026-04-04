import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const SUPPORTED_PLATFORMS = ["discord", "youtube", "twitter"] as const;

const connectIntegrationSchema = z.object({
  platform: z.enum(SUPPORTED_PLATFORMS),
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
});

async function ensureIntegrationsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_integrations (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform        TEXT NOT NULL CHECK (platform IN ('discord', 'youtube', 'twitter')),
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (creator_id, platform)
    )
  `;
}

/**
 * GET /api/routes-f/integrations
 * List connected integrations for the authenticated creator.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureIntegrationsSchema();

    const { rows } = await sql`
      SELECT id, platform, connected_at, updated_at
      FROM route_f_integrations
      WHERE creator_id = ${session.userId}
      ORDER BY connected_at DESC
    `;

    return NextResponse.json({ integrations: rows });
  } catch (error) {
    console.error("[routes-f integrations GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routes-f/integrations
 * Connect a third-party integration.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, connectIntegrationSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { platform, access_token, refresh_token } = bodyResult.data;

  try {
    await ensureIntegrationsSchema();

    const { rows } = await sql`
      INSERT INTO route_f_integrations (creator_id, platform, access_token, refresh_token, updated_at)
      VALUES (${session.userId}, ${platform}, ${access_token}, ${refresh_token ?? null}, NOW())
      ON CONFLICT (creator_id, platform) DO UPDATE SET
        access_token  = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        updated_at    = NOW()
      RETURNING id, platform, connected_at, updated_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[routes-f integrations POST]", error);
    return NextResponse.json(
      { error: "Failed to connect integration" },
      { status: 500 }
    );
  }
}
