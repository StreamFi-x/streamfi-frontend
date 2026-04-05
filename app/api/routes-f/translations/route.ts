import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

/**
 * GET  /api/routes-f/translations?locale=en
 *   Returns all translation key/value pairs for the given locale.
 *   Defaults to "en" if locale not found.
 *   Response is served with Cache-Control: public, max-age=3600.
 *
 * POST /api/routes-f/translations
 *   Upserts a translation key/value pair. Admin-only.
 *   Body: { locale: string; key: string; value: string }
 */

async function ensureTranslationsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_translations (
      id          BIGSERIAL PRIMARY KEY,
      locale      TEXT        NOT NULL,
      key         TEXT        NOT NULL,
      value       TEXT        NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (locale, key)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS route_f_translations_locale_idx
      ON route_f_translations (locale)
  `;
}

const getQuerySchema = z.object({
  locale: z.string().min(2).max(10).default("en"),
});

const upsertBodySchema = z.object({
  locale: z.string().min(2).max(10),
  key: z.string().min(1).max(255),
  value: z.string().min(0),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  const { locale } = queryResult.data;

  try {
    await ensureTranslationsSchema();

    // Try requested locale; fall back to "en" if empty
    let { rows } = await sql`
      SELECT key, value
      FROM route_f_translations
      WHERE locale = ${locale}
      ORDER BY key ASC
    `;

    if (rows.length === 0 && locale !== "en") {
      const fallback = await sql`
        SELECT key, value
        FROM route_f_translations
        WHERE locale = 'en'
        ORDER BY key ASC
      `;
      rows = fallback.rows;
    }

    const translations = Object.fromEntries(rows.map(r => [r.key, r.value]));

    return NextResponse.json(
      { locale: rows.length > 0 ? locale : "en", translations },
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  } catch (error) {
    console.error("[translations] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Admin-only
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const adminCheck = await sql`
    SELECT 1 FROM users WHERE id = ${session.userId} AND is_admin = TRUE LIMIT 1
  `;
  if (adminCheck.rows.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await validateBody(req, upsertBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { locale, key, value } = bodyResult.data;

  try {
    await ensureTranslationsSchema();

    await sql`
      INSERT INTO route_f_translations (locale, key, value, updated_at)
      VALUES (${locale}, ${key}, ${value}, NOW())
      ON CONFLICT (locale, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    return NextResponse.json({ locale, key, value }, { status: 200 });
  } catch (error) {
    console.error("[translations] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
