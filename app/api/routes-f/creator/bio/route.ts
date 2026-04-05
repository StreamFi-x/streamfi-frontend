import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { usernameSchema, urlSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureCreatorBioSchema } from "./_lib/db";

const socialLinkSchema = z.object({
  label: z.string().trim().min(1).max(50),
  url: urlSchema,
});

const updateBioSchema = z.object({
  bio_text: z.string().trim().max(500).optional(),
  social_links: z.array(socialLinkSchema).max(5).optional(),
  schedule_text: z.string().trim().max(200).optional(),
  banner_url: urlSchema.optional(),
});

const getBioQuerySchema = z.object({
  username: usernameSchema,
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getBioQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureCreatorBioSchema();

    const { rows: userRows } = await sql`
      SELECT id FROM users WHERE username = ${queryResult.data.username} LIMIT 1
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const userId = userRows[0].id;

    const { rows } = await sql`
      SELECT bio_text, social_links, schedule_text, banner_url, updated_at
      FROM route_f_creator_bios
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({
        bio_text: null,
        social_links: [],
        schedule_text: null,
        banner_url: null,
        updated_at: null,
      });
    }

    const bio = rows[0];
    return NextResponse.json({
      bio_text: bio.bio_text ?? null,
      social_links: bio.social_links ?? [],
      schedule_text: bio.schedule_text ?? null,
      banner_url: bio.banner_url ?? null,
      updated_at: bio.updated_at,
    });
  } catch (error) {
    console.error("[creator/bio] GET error:", error);
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

  const bodyResult = await validateBody(req, updateBioSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureCreatorBioSchema();

    const { bio_text, social_links, schedule_text, banner_url } =
      bodyResult.data;

    // Upsert bio record
    const { rows } = await sql`
      INSERT INTO route_f_creator_bios (user_id, bio_text, social_links, schedule_text, banner_url, updated_at)
      VALUES (${session.userId}, ${bio_text ?? null}, ${JSON.stringify(social_links ?? [])}, ${schedule_text ?? null}, ${banner_url ?? null}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        bio_text = COALESCE(EXCLUDED.bio_text, route_f_creator_bios.bio_text),
        social_links = COALESCE(EXCLUDED.social_links, route_f_creator_bios.social_links),
        schedule_text = COALESCE(EXCLUDED.schedule_text, route_f_creator_bios.schedule_text),
        banner_url = COALESCE(EXCLUDED.banner_url, route_f_creator_bios.banner_url),
        updated_at = now()
      RETURNING bio_text, social_links, schedule_text, banner_url, updated_at
    `;

    const updated = rows[0];
    return NextResponse.json({
      bio_text: updated.bio_text ?? null,
      social_links: updated.social_links ?? [],
      schedule_text: updated.schedule_text ?? null,
      banner_url: updated.banner_url ?? null,
      updated_at: updated.updated_at,
    });
  } catch (error) {
    console.error("[creator/bio] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
