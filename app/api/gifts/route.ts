import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, emoji, usd_value, sort_order, animation, active
      FROM gifts
      WHERE active = TRUE
      ORDER BY sort_order ASC, id ASC
    `;

    return NextResponse.json(
      { gifts: result.rows },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Failed to load gifts:", error);
    return NextResponse.json({ error: "Failed to load gifts" }, { status: 500 });
  }
}