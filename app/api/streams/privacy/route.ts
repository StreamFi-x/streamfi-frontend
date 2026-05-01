import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { generateShareToken, type StreamPrivacy } from "@/lib/stream-access";

const VALID_PRIVACY: StreamPrivacy[] = [
  "public",
  "unlisted",
  "subscribers_only",
];

/**
 * GET /api/streams/privacy?wallet=...
 * Returns current privacy settings for a creator.
 * The share token is only returned to the creator themselves (server-side check
 * to be added once we wire this in via verifySession; for now caller is trusted
 * because the route is called from owner-only UI).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter required" },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT id, stream_privacy, share_token
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const user = result.rows[0];
    return NextResponse.json({
      privacy: user.stream_privacy || "public",
      shareToken: user.share_token,
    });
  } catch (err) {
    console.error("[streams/privacy] GET error:", err);
    return NextResponse.json(
      { error: "Failed to load privacy settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/streams/privacy
 * Body: { wallet, privacy?, rotate_token? }
 *   - privacy: one of "public" | "unlisted" | "subscribers_only"
 *   - rotate_token: when true, generate a new share token (invalidates old links)
 *
 * Generates a share token automatically the first time the creator switches to a
 * non-public privacy mode if none exists yet.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, privacy, rotate_token } = body ?? {};

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    if (privacy !== undefined && !VALID_PRIVACY.includes(privacy)) {
      return NextResponse.json(
        { error: "invalid privacy value" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT id, stream_privacy, share_token
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const nextPrivacy: StreamPrivacy =
      privacy ?? (user.stream_privacy || "public");
    let nextToken: string | null = user.share_token;

    // If switching to a private mode and no token exists yet, generate one
    if (nextPrivacy !== "public" && !nextToken) {
      nextToken = generateShareToken();
    }
    // Explicit rotation
    if (rotate_token) {
      nextToken = generateShareToken();
    }

    await sql`
      UPDATE users SET
        stream_privacy = ${nextPrivacy},
        share_token = ${nextToken},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;

    return NextResponse.json({
      privacy: nextPrivacy,
      shareToken: nextToken,
    });
  } catch (err) {
    console.error("[streams/privacy] POST error:", err);
    return NextResponse.json(
      { error: "Failed to update privacy settings" },
      { status: 500 }
    );
  }
}
