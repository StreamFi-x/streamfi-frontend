import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { cacheHeaders } from "@/lib/cache";
import { verifySession } from "@/lib/auth/verify-session";

// Credential material that no client ever needs, regardless of who is
// asking. The rest of the row is only returned to the wallet's own owner
// (checked below) — the comment this replaced claimed that was already
// true "because the auth provider loads the signed-in user's own profile
// through this route", but nothing actually enforced it (#1612): any
// caller, authenticated as anyone or no one, got the full row including
// streamkey, privy_id, and email for any wallet they asked for.
const SERVER_ONLY_COLUMNS = [
  "password_hash",
  "encrypted_stellar_key",
  "stream_password_hash",
] as const;

// Additionally stripped from the response unless the caller IS this wallet.
const OWNER_ONLY_COLUMNS = ["streamkey", "privy_id", "email"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicKey: string }> }
) {
  try {
    const { publicKey: wallet } = await params;

    // Stellar public keys are uppercase; use exact match
    const result = await sql`
      SELECT * FROM users WHERE wallet = ${wallet} AND deleted_at IS NULL
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

    const session = await verifySession(req);
    const isOwner = session.ok && session.wallet === wallet;
    if (!isOwner) {
      for (const column of OWNER_ONLY_COLUMNS) {
        delete user[column];
      }
    }

    // Includes email and stream keys for the owner's own request, so it must
    // never enter a shared cache.
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
