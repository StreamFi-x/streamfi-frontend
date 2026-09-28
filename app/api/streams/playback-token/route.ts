import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { canAccessStream } from "@/lib/stream-access";
import { hasStreamPasswordGrant } from "@/lib/stream-password";
import { verifySession } from "@/lib/auth/verify-session";
import {
  isSigningConfigured,
  mintPlaybackToken,
} from "@/lib/mux/playback-token";

/**
 * GET /api/streams/playback-token?username=...&key=...&viewer_wallet=...
 *
 * Returns a signed Mux JWT for the creator's signed playback ID, but ONLY after
 * verifying the viewer is authorized (creator self, valid share token, or active
 * subscription). For public streams, returns { signed: false } and the client
 * should use the public playback ID directly.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const providedToken = searchParams.get("key");
    const viewerWallet = searchParams.get("viewer_wallet");

    if (!username) {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }

    const userResult = await sql`
            SELECT id, stream_privacy, share_token, stream_password_hash,
              mux_playback_id, mux_signed_playback_id,
              (SELECT id FROM stream_sessions ss WHERE ss.user_id = users.id AND ss.ended_at IS NULL ORDER BY ss.started_at DESC LIMIT 1) AS stream_session_id
      FROM users
      WHERE LOWER(username) = LOWER(${username})
    `;
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const creator = userResult.rows[0];
    const verifiedViewer = await verifySession(req);
    const verifiedViewerId = verifiedViewer.ok ? verifiedViewer.userId : null;

    // Resolve viewer's user id (best-effort) so we can check subscriptions / owner
    let viewerUserId: string | null = null;
    if (viewerWallet) {
      const viewer = await sql`
        SELECT id FROM users WHERE LOWER(wallet) = LOWER(${viewerWallet})
      `;
      viewerUserId = viewer.rows[0]?.id ?? null;
    }

    if (creator.stream_password_hash && creator.id !== verifiedViewerId &&
        (!creator.stream_session_id || !hasStreamPasswordGrant(req, creator.id, creator.stream_session_id))) {
      return NextResponse.json({ error: "access_denied", reason: "password_required" }, { status: 403 });
    }

    const access = await canAccessStream({
      privacy: creator.stream_privacy,
      streamShareToken: creator.share_token,
      providedToken,
      creatorUserId: creator.id,
      viewerUserId,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { error: "access_denied", reason: access.reason },
        { status: 403 }
      );
    }

    const privacy = creator.stream_privacy || "public";

    // Public streams don't need a signed token
    if (privacy === "public") {
      return NextResponse.json({
        signed: false,
        playbackId: creator.mux_playback_id,
      });
    }

    // Private streams: mint signed JWT for the signed playback ID
    const signedId = creator.mux_signed_playback_id;
    if (!signedId || !isSigningConfigured()) {
      // Mux Pro keys not configured yet — degrade gracefully to public playback
      // (still gated by share_token at the app layer; once Mux Pro is on, the
      // creator should re-provision their stream key to get a signed playback ID).
      return NextResponse.json({
        signed: false,
        playbackId: creator.mux_playback_id,
        warning:
          "Signed playback not configured — viewer is gated by share token only",
      });
    }

    const token = mintPlaybackToken(signedId, { audience: "v" });
    if (!token) {
      return NextResponse.json(
        { error: "failed_to_mint_token" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed: true,
      playbackId: signedId,
      token,
    });
  } catch (err) {
    console.error("[streams/playback-token] error:", err);
    return NextResponse.json(
      { error: "Failed to issue playback token" },
      { status: 500 }
    );
  }
}
