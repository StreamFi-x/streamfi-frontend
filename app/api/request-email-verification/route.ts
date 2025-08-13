import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { sendEmailVerificationToken } from "@/utils/send-email";
import { randomInt } from "crypto";

// Generate 6-digit token
function generateToken() {
  return randomInt(100000, 999999).toString();
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists
    const { rows: users } = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = generateToken();

    // Remove any existing token for this email
    await sql`DELETE FROM verification_tokens WHERE email = ${email}`;

    // Insert the new token
    await sql`
      INSERT INTO verification_tokens (email, token, created_at)
      VALUES (${email}, ${token}, CURRENT_TIMESTAMP)
    `;

    // Send token via email
    await sendEmailVerificationToken(email, token);

    return NextResponse.json(
      { message: "Verification token sent to email" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email verification token error:", error);
    return NextResponse.json(
      { error: "Failed to send verification token" },
      { status: 500 }
    );
  }
}
