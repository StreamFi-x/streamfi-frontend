import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyPassword } from "@/lib/stream-access/password";
import { issueStreamAccessToken } from "@/lib/stream-access/token";
import { createRateLimiter } from "@/lib/rate-limit";

const rateLimiter = createRateLimiter(15 * 60 * 1000, 5);

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { playbackId, password } = await req.json();

    if (!playbackId || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const rateLimitKey = `stream-pwd:${ip}:${playbackId}`;
    if (await rateLimiter(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const { rows } = await sql`
      SELECT id, stream_password_hash
      FROM users
      WHERE mux_playback_id = ${playbackId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const user = rows[0];

    if (!user.stream_password_hash) {
      return NextResponse.json(
        { error: "Stream is not password protected" },
        { status: 400 }
      );
    }

    if (!verifyPassword(password, user.stream_password_hash)) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    const token = issueStreamAccessToken(user.id);

    return NextResponse.json({ token }, { status: 200 });
  } catch (error) {
    console.error("Password verification error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
