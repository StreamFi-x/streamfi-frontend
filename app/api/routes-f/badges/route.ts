import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, description, icon, tier, sort_order
      FROM badge_definitions
      ORDER BY sort_order ASC, name ASC
    `;

    return NextResponse.json({
      badges: result.rows.map(row => ({
        id: String(row.id),
        name: String(row.name),
        description: String(row.description),
        icon: String(row.icon),
        tier: String(row.tier),
        sort_order: Number.parseInt(String(row.sort_order), 10),
      })),
      total: result.rows.length,
    });
  } catch (error) {
    console.error("[routes-f badges GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch badge definitions" },
      { status: 500 }
    );
  }
}
