import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureTemplatesSchema } from "./_lib/db";

const TAG_LIMIT = 5;
const TAG_LENGTH_LIMIT = 25;
const TEMPLATE_LIMIT = 10;

const tagsSchema = z
  .array(z.string().trim().min(1).max(TAG_LENGTH_LIMIT))
  .max(TAG_LIMIT);

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(140),
  category: z.string().trim().max(80).optional().default(""),
  tags: tagsSchema.optional().default([]),
  description: z.string().trim().max(500).optional().default(""),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureTemplatesSchema();

    const { rows } = await sql`
      SELECT id, name, title, category, tags, description, created_at, updated_at
      FROM route_f_stream_templates
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ templates: rows });
  } catch (error) {
    console.error("[templates] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createTemplateSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { name, title, category, tags, description } = bodyResult.data;

  try {
    await ensureTemplatesSchema();

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS template_count
      FROM route_f_stream_templates
      WHERE user_id = ${session.userId}
    `;

    if (Number(countRows[0]?.template_count ?? 0) >= TEMPLATE_LIMIT) {
      return NextResponse.json(
        { error: `Creators may only have ${TEMPLATE_LIMIT} templates` },
        { status: 409 }
      );
    }

    const { rows: duplicateRows } = await sql`
      SELECT id
      FROM route_f_stream_templates
      WHERE user_id = ${session.userId}
        AND LOWER(name) = LOWER(${name})
      LIMIT 1
    `;

    if (duplicateRows.length > 0) {
      return NextResponse.json(
        { error: "Template name must be unique per creator" },
        { status: 409 }
      );
    }

    const { rows } = await sql`
      INSERT INTO route_f_stream_templates (
        user_id,
        name,
        title,
        category,
        tags,
        description
      )
      VALUES (
        ${session.userId},
        ${name},
        ${title},
        ${category || null},
        ${JSON.stringify(tags)},
        ${description || null}
      )
      RETURNING id, user_id, name, title, category, tags, description, created_at, updated_at
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("[templates] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
