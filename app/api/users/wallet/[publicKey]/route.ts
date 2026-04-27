import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicKey: string }> }
) {
  try {
    const { publicKey: wallet } = await params;
    console.log("API: Fetching user for wallet:", wallet);

    // Stellar public keys are uppercase; use exact match
    const result = await sql`
      SELECT * FROM users WHERE wallet = ${wallet}
    `;

    console.log("API: Query result rows:", result.rowCount);

    const user = result.rows[0];

    if (!user) {
      console.log("API: User not found for wallet:", wallet);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Never expose password hash in API responses
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { stream_password_hash, ...safeUser } = user;

    console.log("API: User found:", safeUser.username);
    return NextResponse.json(
      { user: safeUser },
      {
        headers: {
          // Cache for 60 seconds, serve stale for 2 minutes while revalidating
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
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
