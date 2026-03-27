import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

const countryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Country codes must be ISO 3166-1 alpha-2")
  .transform(v => v.toUpperCase());

const updateGeoSchema = z.object({
  allowed_countries: z.array(countryCodeSchema).max(250).optional(),
  blocked_countries: z.array(countryCodeSchema).max(250).optional(),
});

const checkQuerySchema = z.object({
  creator: z.string().uuid("creator must be a valid UUID"),
});

async function ensureGeoTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_geo_restrictions (
      creator_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      allowed_countries TEXT[] NOT NULL DEFAULT '{}',
      blocked_countries TEXT[] NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function normalizeCodes(codes?: string[]) {
  if (!codes) {
    return undefined;
  }
  return [...new Set(codes.map(code => code.toUpperCase()))];
}

function requestCountry(req: NextRequest): string | null {
  const candidate =
    req.headers.get("CF-IPCountry") ?? req.headers.get("X-Vercel-IP-Country");

  if (!candidate) {
    return null;
  }

  const upper = candidate.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) {
    return null;
  }

  return upper;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  if (url.searchParams.has("creator")) {
    const queryResult = validateQuery(url.searchParams, checkQuerySchema);
    if (queryResult instanceof Response) {
      return queryResult;
    }

    try {
      await ensureGeoTable();
      const viewerCountry = requestCountry(req);
      const { creator } = queryResult.data;

      const { rows } = await sql`
        SELECT allowed_countries, blocked_countries
        FROM creator_geo_restrictions
        WHERE creator_id = ${creator}
        LIMIT 1
      `;

      const allowed =
        (rows[0]?.allowed_countries as string[] | undefined) ?? [];
      const blocked =
        (rows[0]?.blocked_countries as string[] | undefined) ?? [];

      if (!viewerCountry) {
        return NextResponse.json({
          creator_id: creator,
          viewer_country: null,
          allowed: true,
          reason: "viewer_country_unknown",
        });
      }

      if (blocked.includes(viewerCountry)) {
        return NextResponse.json(
          {
            creator_id: creator,
            viewer_country: viewerCountry,
            allowed: false,
            reason: "blocked_country",
          },
          { status: 451 }
        );
      }

      if (allowed.length > 0 && !allowed.includes(viewerCountry)) {
        return NextResponse.json(
          {
            creator_id: creator,
            viewer_country: viewerCountry,
            allowed: false,
            reason: "not_in_allowed_list",
          },
          { status: 451 }
        );
      }

      return NextResponse.json({
        creator_id: creator,
        viewer_country: viewerCountry,
        allowed: true,
      });
    } catch (err) {
      console.error("[geo/check] GET error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureGeoTable();

    const { rows } = await sql`
      SELECT allowed_countries, blocked_countries, updated_at
      FROM creator_geo_restrictions
      WHERE creator_id = ${session.userId}
      LIMIT 1
    `;

    return NextResponse.json({
      creator_id: session.userId,
      allowed_countries:
        (rows[0]?.allowed_countries as string[] | undefined) ?? [],
      blocked_countries:
        (rows[0]?.blocked_countries as string[] | undefined) ?? [],
      updated_at: rows[0]?.updated_at ?? null,
    });
  } catch (err) {
    console.error("[geo] GET error:", err);
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

  const bodyResult = await validateBody(req, updateGeoSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const allowed = normalizeCodes(bodyResult.data.allowed_countries);
  const blocked = normalizeCodes(bodyResult.data.blocked_countries);

  if (allowed && blocked) {
    const conflict = allowed.find(code => blocked.includes(code));
    if (conflict) {
      return NextResponse.json(
        { error: `Country ${conflict} cannot be both allowed and blocked` },
        { status: 400 }
      );
    }
  }

  try {
    await ensureGeoTable();

    const { rows: existing } = await sql`
      SELECT allowed_countries, blocked_countries
      FROM creator_geo_restrictions
      WHERE creator_id = ${session.userId}
      LIMIT 1
    `;

    const nextAllowed =
      allowed ?? (existing[0]?.allowed_countries as string[] | undefined) ?? [];
    const nextBlocked =
      blocked ?? (existing[0]?.blocked_countries as string[] | undefined) ?? [];

    const { rows } = await sql`
      INSERT INTO creator_geo_restrictions (
        creator_id,
        allowed_countries,
        blocked_countries,
        updated_at
      )
      VALUES (
        ${session.userId},
        ${nextAllowed}::text[],
        ${nextBlocked}::text[],
        NOW()
      )
      ON CONFLICT (creator_id)
      DO UPDATE SET
        allowed_countries = EXCLUDED.allowed_countries,
        blocked_countries = EXCLUDED.blocked_countries,
        updated_at = NOW()
      RETURNING creator_id, allowed_countries, blocked_countries, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[geo] PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
