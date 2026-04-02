import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * GET /api/routes-f/translations/locales
 * Returns a list of all locale codes that have at least one translation entry.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { rows } = await sql`
      SELECT DISTINCT locale
      FROM route_f_translations
      ORDER BY locale ASC
    `;

    return NextResponse.json(
      { locales: rows.map(r => r.locale) },
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  } catch (error) {
    console.error("[translations/locales] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
