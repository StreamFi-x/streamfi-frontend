import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { generateShareToken, type StreamPrivacy } from "@/lib/stream-access";
import { verifySession } from "@/lib/auth/verify-session";

const VALID_PRIVACY: StreamPrivacy[] = [
  "public",
  "unlisted",
  "subscribers_only",
];

/**
 * GET /api/streams/privacy
 * Returns current privacy settings for a creator.
 * Authenticated via verifySession: only the authenticated user can access their own
 * stream privacy and share token.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const { searchParams } = new URL(req.url);
    const requestedWallet = searchParams.get("wallet");

    // If a wallet query param is supplied, verify caller owns it
    if (
      requestedWallet &&
      session.wallet &&
      session.wallet.toLowerCase() !== requestedWallet.toLowerCase()
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await sql`
      SELECT id, stream_privacy, share_token, wallet
      FROM users
      WHERE id = ${session.userId}
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
 * Body: { privacy?, rotate_token? } (wallet in body is validated against session)
 *   - privacy: one of "public" | "unlisted" | "subscribers_only"
 *   - rotate_token: when true, generate a new share token (invalidates old links)
 *
 * Generates a share token automatically the first time the creator switches to a
 * non-public privacy mode if none exists yet.
 * Authenticated: updates are strictly applied to the verified session user.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const body = await req.json();
    const { wallet, privacy, rotate_token } = body ?? {};

    // Forbid updating another user's privacy settings
    if (
      wallet &&
      session.wallet &&
      session.wallet.toLowerCase() !== wallet.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (privacy !== undefined && !VALID_PRIVACY.includes(privacy)) {
      return NextResponse.json(
        { error: "invalid privacy value" },
        { status: 400 }
      );
    }

    // Always operate on the authenticated user from session, never client-supplied ID
    const userResult = await sql`
      SELECT id, stream_privacy, share_token
      FROM users
      WHERE id = ${session.userId}
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
