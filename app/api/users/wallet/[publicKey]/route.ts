import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { cacheHeaders } from "@/lib/cache";
import { verifySession } from "@/lib/auth/verify-session";
import {
  apiInternalError,
  apiMethodNotAllowed,
  apiNotFound,
  apiSuccess,
} from "@/lib/api";

// Credential material that no client ever needs, regardless of who is
// asking. The rest of the row is only returned to the wallet's own owner
// (checked below).
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
      return apiNotFound("User not found", {
        headers: cacheHeaders("privateNoStore"),
      });
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
    return apiSuccess(
      { user },
      { headers: cacheHeaders("privateNoStore"), legacyFlat: true }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("API: Fetch user error:", error);
    return apiInternalError("Failed to fetch user");
  }
}

export async function POST() {
  return apiMethodNotAllowed("GET");
}
