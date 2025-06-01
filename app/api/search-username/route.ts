import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const results = await sql`
      SELECT username 
      FROM users 
      WHERE username ILIKE ${"%" + query + "%"}
      LIMIT 10;
    `;

    return NextResponse.json(
      { usernames: results.rows.map((row) => row.username) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Username search error:", error);
    return NextResponse.json(
      { error: "Failed to search usernames" },
      { status: 500 }
    );
  }
}
