import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureProfilePanelsSchema } from "./_lib/db";

const querySchema = z.object({
  channel: z.string().uuid(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { channel } = queryResult.data;

  try {
    await ensureProfilePanelsSchema();

    const channelResult = await sql`
      SELECT id FROM users WHERE id = ${channel} LIMIT 1
    `;

    if (channelResult.rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const panelsResult = await sql<{
      id: string;
      title: string;
      body: string;
      image_url: string | null;
      position: number;
    }>`
      SELECT id, title, body, image_url, position
      FROM channel_panels
      WHERE channel_id = ${channel}
      ORDER BY position ASC, created_at ASC
    `;

    return NextResponse.json({
      channel,
      panels: panelsResult.rows,
    });
  } catch (error) {
    console.error("[routes-f/profile-panels-list] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
