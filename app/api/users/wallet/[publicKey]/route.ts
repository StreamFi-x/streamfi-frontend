import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { cacheHeaders } from "@/lib/cache";

// Credential material that no client ever needs. The rest of the row is still
// returned because the auth provider loads the signed-in user's own profile
// through this route; see docs/caching-policy.md for why it is not cached.
const SERVER_ONLY_COLUMNS = [
  "password_hash",
  "encrypted_stellar_key",
  "stream_password_hash",
] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicKey: string }> }
) {
  try {
    const { publicKey: wallet } = await params;

    // Stellar public keys are uppercase; use exact match
    const result = await sql`
      SELECT * FROM users WHERE wallet = ${wallet}
    `;

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: cacheHeaders("privateNoStore") }
      );
    }

    for (const column of SERVER_ONLY_COLUMNS) {
      delete user[column];
    }

    // Includes email and stream keys, so it must never enter a shared cache.
    return NextResponse.json(
      { user },
      { headers: cacheHeaders("privateNoStore") }
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
