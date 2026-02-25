import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isValidStellarAddress } from "@/utils/stellar";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    console.log("API: Fetching user for wallet:", wallet);

    if (!isValidStellarAddress(wallet)) {
      return NextResponse.json(
        { error: "Invalid wallet address. Must be a valid Stellar public key." },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT * FROM users WHERE wallet = ${wallet}
    `;

    console.log("API: Query result rows:", result.rowCount);

    const user = result.rows[0];

    if (!user) {
      console.log("API: User not found for wallet:", wallet);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("API: User found:", user.username);
    return NextResponse.json(
      { user },
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
