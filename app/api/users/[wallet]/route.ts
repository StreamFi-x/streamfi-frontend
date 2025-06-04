import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(
  req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    console.log("API: Fetching user for wallet:", params.wallet);

    // Normalize the wallet address to lowercase for consistent comparison
    const normalizedWallet = params.wallet.toLowerCase();

    const result = await sql`
      SELECT * FROM users WHERE LOWER(wallet) = ${normalizedWallet}
    `;

    console.log("API: Query result rows:", result.rowCount);

    const user = result.rows[0]; 

    if (!user) {
      console.log("API: User not found for wallet:", params.wallet);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("API: User found:", user.username);
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
