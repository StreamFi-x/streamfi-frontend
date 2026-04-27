import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const result = await sql`
      SELECT bd.id, bd.name, bd.description, bd.icon, bd.tier, ub.earned_at
      FROM users u
      INNER JOIN user_badges ub ON ub.user_id = u.id
      INNER JOIN badge_definitions bd ON bd.id = ub.badge_id
      WHERE LOWER(u.username) = ${username.toLowerCase()}
      ORDER BY bd.sort_order ASC, ub.earned_at ASC
    `;

    return NextResponse.json({
      badges: result.rows.map(row => ({
        id: String(row.id),
        name: String(row.name),
        description: String(row.description),
        icon: String(row.icon),
        tier: String(row.tier),
        earned_at: new Date(String(row.earned_at)).toISOString(),
      })),
      total: result.rows.length,
    });
  } catch (error) {
    console.error("[routes-f badges by username GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creator badges" },
      { status: 500 }
    );
  }
}
