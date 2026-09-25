import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureProfilePanelsSchema } from "./_lib/db";
import { withTransaction } from "@/lib/postgres-transaction";

const MAX_PANELS = 12;

const panelSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1),
  image_url: z.string().url().max(2048).optional(),
});

const upsertPanelsSchema = z.object({
  panels: z.array(panelSchema).max(MAX_PANELS),
});

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, upsertPanelsSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { panels } = bodyResult.data;

  // Delete-then-reinsert must be atomic, so it runs on one pooled connection
  // (lib/postgres-transaction.ts) rather than as separate `sql` requests.
  try {
    await ensureProfilePanelsSchema();

    const inserted = await withTransaction(async client => {
      await client.sql`DELETE FROM channel_panels WHERE channel_id = ${session.userId}`;

      const rowsOut: {
        id: string;
        title: string;
        body: string;
        image_url: string | null;
        position: number;
      }[] = [];

      for (let index = 0; index < panels.length; index += 1) {
        const panel = panels[index];
        const { rows } = await client.sql`
          INSERT INTO channel_panels (channel_id, title, body, image_url, position)
          VALUES (
            ${session.userId},
            ${panel.title},
            ${panel.body},
            ${panel.image_url ?? null},
            ${index}
          )
          RETURNING id, title, body, image_url, position
        `;
        rowsOut.push(rows[0] as (typeof rowsOut)[number]);
      }
      return rowsOut;
    });

    return NextResponse.json({
      channel: session.userId,
      panels: inserted,
    });
  } catch (error) {
    console.error("[routes-f/profile-panels-upsert] PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
