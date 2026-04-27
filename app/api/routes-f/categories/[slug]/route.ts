import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const updateCategorySchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    thumbnail_url: z.string().url().max(2048).nullable().optional(),
  })
  .refine(
    body => body.title !== undefined || body.thumbnail_url !== undefined,
    "At least one field is required"
  );

function toSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureCategoriesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stream_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      thumbnail_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function requireAdmin(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }

  const { rows } = await sql`
    SELECT 1
    FROM users
    WHERE id = ${session.userId}
      AND (
        is_admin = TRUE
        OR role = 'admin'
      )
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;

  try {
    await ensureCategoriesTable();

    const { rows: categoryRows } = await sql`
      SELECT slug, name, thumbnail_url, created_at, updated_at
      FROM stream_categories
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (categoryRows.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const category = categoryRows[0];

    const { rows: streamRows } = await sql`
      SELECT
        u.id,
        u.username,
        u.avatar,
        u.is_live,
        u.current_viewers,
        u.mux_playback_id,
        COALESCE(u.creator->>'streamTitle', u.creator->>'title') AS stream_title,
        u.stream_started_at
      FROM users u
      WHERE LOWER(COALESCE(u.creator->>'category', '')) = LOWER(${category.name as string})
        AND u.is_live = TRUE
      ORDER BY u.current_viewers DESC, u.stream_started_at DESC
    `;

    return NextResponse.json({
      category: {
        ...category,
        stream_count: streamRows.length,
        viewer_count: streamRows.reduce(
          (sum, row) => sum + Number(row.current_viewers ?? 0),
          0
        ),
      },
      live_streams: streamRows,
    });
  } catch (err) {
    console.error("[categories/:slug] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const { slug } = await params;
  const bodyResult = await validateBody(req, updateCategorySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureCategoriesTable();

    const { rows: existingRows } = await sql`
      SELECT slug, name, thumbnail_url
      FROM stream_categories
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const existing = existingRows[0];
    const nextName = bodyResult.data.title?.trim() ?? (existing.name as string);
    const nextSlug = bodyResult.data.title
      ? toSlug(bodyResult.data.title)
      : slug;
    if (!nextSlug) {
      return NextResponse.json(
        { error: "title must contain URL-safe lowercase characters" },
        { status: 400 }
      );
    }

    const nextThumb =
      bodyResult.data.thumbnail_url !== undefined
        ? bodyResult.data.thumbnail_url
        : (existing.thumbnail_url as string | null);

    const { rows } = await sql`
      UPDATE stream_categories
      SET
        slug = ${nextSlug},
        name = ${nextName},
        thumbnail_url = ${nextThumb},
        updated_at = NOW()
      WHERE slug = ${slug}
      RETURNING slug, name, thumbnail_url, created_at, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[categories/:slug] PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const { slug } = await params;

  try {
    await ensureCategoriesTable();

    const { rowCount } = await sql`
      DELETE FROM stream_categories
      WHERE slug = ${slug}
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Category removed" });
  } catch (err) {
    console.error("[categories/:slug] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
