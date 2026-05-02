import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { validateStreamAccessToken } from "@/lib/stream-access/token";
import { checkSubscriptionAccess } from "@/lib/stream/access";

export async function POST(req: NextRequest) {
  try {
    const { playbackId, token, viewerPublicKey } = await req.json();

    if (!playbackId) {
      return NextResponse.json(
        { error: "Missing playbackId" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      SELECT id, stream_password_hash, stream_access_type
      FROM users
      WHERE mux_playback_id = ${playbackId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const user = rows[0];

    if (user.stream_access_type === "subscription") {
      const result = await checkSubscriptionAccess(
        user.id,
        typeof viewerPublicKey === "string" ? viewerPublicKey : null
      );
      return NextResponse.json(result, { status: 200 });
    }

    if (!user.stream_password_hash) {
      return NextResponse.json({ allowed: true }, { status: 200 });
    }

    if (!token || !validateStreamAccessToken(token, user.id)) {
      return NextResponse.json(
        { allowed: false, reason: "password" },
        { status: 200 }
      );
    }

    return NextResponse.json({ allowed: true }, { status: 200 });
  } catch (error) {
    console.error("Access check error:", error);
    return NextResponse.json({ error: "Access check failed" }, { status: 500 });
  }
}
