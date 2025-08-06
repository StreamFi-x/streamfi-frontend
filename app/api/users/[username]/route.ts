import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const normalizedUsername = params.username.toLowerCase();

    const result = await sql`
      SELECT * FROM users WHERE LOWER(username) = ${normalizedUsername}
    `;

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("API: Fetch user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
