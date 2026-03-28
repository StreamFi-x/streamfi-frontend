import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureTemplatesSchema } from "../_lib/db";

const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    title: z.string().trim().min(1).max(140).optional(),
    category: z.string().trim().max(80).optional(),
    tags: z.array(z.string().trim().min(1).max(25)).max(5).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, updateTemplateSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { id } = await params;
  const { name, title, category, tags, description } = bodyResult.data;

  try {
    await ensureTemplatesSchema();

    const { rows: existingRows } = await sql`
      SELECT id, name, title, category, tags, description
      FROM route_f_stream_templates
      WHERE id = ${id} AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (name) {
      const { rows: duplicateRows } = await sql`
        SELECT id
        FROM route_f_stream_templates
        WHERE user_id = ${session.userId}
          AND LOWER(name) = LOWER(${name})
          AND id <> ${id}
        LIMIT 1
      `;

      if (duplicateRows.length > 0) {
        return NextResponse.json(
          { error: "Template name must be unique per creator" },
          { status: 409 }
        );
      }
    }

    const existing = existingRows[0];
    const nextName = name ?? existing.name;
    const nextTitle = title ?? existing.title;
    const nextCategory = category ?? existing.category;
    const nextTags = tags ?? existing.tags ?? [];
    const nextDescription = description ?? existing.description;

    const { rows } = await sql`
      UPDATE route_f_stream_templates
      SET
        name = ${nextName},
        title = ${nextTitle},
        category = ${nextCategory || null},
        tags = ${JSON.stringify(nextTags)},
        description = ${nextDescription || null},
        updated_at = now()
      WHERE id = ${id} AND user_id = ${session.userId}
      RETURNING id, user_id, name, title, category, tags, description, created_at, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[templates] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureTemplatesSchema();

    const { rows } = await sql`
      DELETE FROM route_f_stream_templates
      WHERE id = ${id} AND user_id = ${session.userId}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("[templates] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
