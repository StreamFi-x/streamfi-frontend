import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { invalidateUserCaches } from "@/lib/cache/invalidation";

export async function POST(req: Request) {
  const body = await req.json();
  const { email, token } = body;

  if (!email || !token) {
    return NextResponse.json(
      { error: "Email and token are required" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Check if token is valid
    const result = await sql`
      SELECT * FROM verification_tokens
      WHERE email = ${email} AND token = ${token}
    `;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    // Step 2: Mark email as verified
    const { rows: verifiedUsers } = await sql`
      UPDATE users SET emailVerified = true WHERE email = ${email}
      RETURNING username, wallet
    `;
    for (const verified of verifiedUsers) {
      await invalidateUserCaches(verified);
    }

    // Optional: delete token after use
    await sql`
      DELETE FROM verification_tokens WHERE email = ${email}
    `;

    return NextResponse.json(
      { message: "Email successfully verified" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}
