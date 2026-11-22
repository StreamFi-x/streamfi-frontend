// SPDX-License-Identifier: MIT

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { sql } from "@vercel/postgres";
import { compare, hash } from "bcryptjs";

const limiter = createRateLimit({
  namespace: "auth:change-password",
  limit: 5,
  windowMs: 15 * 60 * 1000,
});

export async function POST(req: Request) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const rateCheck = await limiter.check(session.userId);
  if (!rateCheck.success) {
    return tooManyRequests(rateCheck, "Too many password change attempts. Please try again later.");
  }

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      SELECT id, password_hash FROM users WHERE id = ${session.userId} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const user = rows[0];
    if (user.password_hash) {
      const match = await compare(currentPassword, user.password_hash);
      if (!match) {
        return NextResponse.json({ error: "Incorrect current password." }, { status: 401 });
      }
    }

    const newHash = await hash(newPassword, 12);
    await sql`
      UPDATE users SET password_hash = ${newHash}, updated_at = NOW() WHERE id = ${session.userId}
    `;

    return NextResponse.json({ message: "Password updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
  }
}
