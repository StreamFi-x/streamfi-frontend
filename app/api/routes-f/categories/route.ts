import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const createCategorySchema = z.object({
  title: z.string().trim().min(1).max(80),
  thumbnail_url: z.string().url().max(2048).optional(),
});

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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_stream_categories_slug
    ON stream_categories (slug)
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

export async function GET(): Promise<NextResponse> {
  try {
    await ensureCategoriesTable();

    const { rows } = await sql`
      SELECT
        c.slug,
        c.name,
        c.thumbnail_url,
        c.created_at,
        c.updated_at,
        COUNT(u.id)::int AS stream_count,
        COALESCE(SUM(CASE WHEN u.is_live THEN u.current_viewers ELSE 0 END), 0)::int AS viewer_count
      FROM stream_categories c
      LEFT JOIN users u
        ON LOWER(COALESCE(u.creator->>'category', '')) = LOWER(c.name)
      GROUP BY c.slug, c.name, c.thumbnail_url, c.created_at, c.updated_at
      ORDER BY viewer_count DESC, stream_count DESC, c.name ASC
    `;

    return NextResponse.json({ categories: rows });
  } catch (err) {
    console.error("[categories] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const bodyResult = await validateBody(req, createCategorySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const slug = toSlug(bodyResult.data.title);
  if (!slug) {
    return NextResponse.json(
      { error: "title must contain URL-safe lowercase characters" },
      { status: 400 }
    );
  }

  try {
    await ensureCategoriesTable();

    const { rows } = await sql`
      INSERT INTO stream_categories (slug, name, thumbnail_url)
      VALUES (${slug}, ${bodyResult.data.title.trim()}, ${bodyResult.data.thumbnail_url ?? null})
      ON CONFLICT (slug) DO NOTHING
      RETURNING slug, name, thumbnail_url, created_at, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[categories] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
