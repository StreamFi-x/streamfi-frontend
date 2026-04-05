import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

const SUPPORTED_PLATFORMS = ["discord", "youtube", "twitter"] as const;

/**
 * DELETE /api/routes-f/integrations/[platform]
 * Disconnect a third-party integration.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { platform: rawPlatform } = await params;
  const platform = rawPlatform.toLowerCase();

  if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platform)) {
    return NextResponse.json(
      {
        error: `Unsupported platform. Must be one of: ${SUPPORTED_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const { rowCount } = await sql`
      DELETE FROM route_f_integrations
      WHERE creator_id = ${session.userId} AND platform = ${platform}
    `;

    if (rowCount === 0) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, platform });
  } catch (error) {
    console.error("[routes-f integrations DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
