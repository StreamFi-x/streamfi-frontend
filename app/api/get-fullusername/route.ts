import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (req.method === "GET") {
    try {
      if (!username) {
        return NextResponse.json(
          { error: "Please provide a username to fetch" },
          { status: 400 }
        );
      }

      const result =
        await sql`SELECT username FROM users WHERE username = ${username}`;

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(
        { username: result.rows[0].username },
        { status: 200 }
      );
    } catch (err) {
      console.error("Error fetching username:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export { handler as GET };
