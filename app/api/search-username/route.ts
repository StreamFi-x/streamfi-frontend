import { sql } from "@vercel/postgres";
import { routesFSuccess, routesFError } from "..//routesF/response";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
      return routesFError("Query parameter 'q' is required", 400);
    }

    const results = await sql`
      SELECT username 
      FROM users 
      WHERE username ILIKE ${"%" + query + "%"}
      LIMIT 10;
    `;

    return routesFSuccess(
      { usernames: results.rows.map(row => row.username) },
      200
    );
  } catch (error) {
    console.error("Username search error:", error);
    return routesFError("Failed to search usernames", 500);
  }
}