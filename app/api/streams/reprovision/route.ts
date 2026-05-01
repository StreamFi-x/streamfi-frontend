import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import {
  createMuxStream,
  deleteMuxStream,
  type MuxStreamData,
} from "@/lib/mux/server";
import { isSigningConfigured } from "@/lib/mux/playback-token";

/**
 * POST /api/streams/reprovision
 * Body: { wallet: string }
 *
 * Recreates the user's Mux live stream so saved preferences (latency_mode,
 * stream_privacy, enable_recording) actually take effect at Mux. This rotates
 * the stream key — caller must warn the streamer to update OBS afterward.
 *
 * Refuses to reprovision while the stream is currently live to avoid cutting
 * off active broadcasts.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet } = body ?? {};

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      SELECT id, username, creator, mux_stream_id,
             enable_recording, latency_mode, stream_privacy,
             is_live
      FROM users
      WHERE LOWER(wallet) = LOWER(${wallet})
    `;
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const user = userResult.rows[0];

    if (user.is_live) {
      return NextResponse.json(
        {
          error: "Cannot reprovision while live",
          detail:
            "End your current stream before applying new settings — the new stream key won't activate until OBS is updated.",
        },
        { status: 409 }
      );
    }

    const enableRecording = user.enable_recording === true;
    const latencyMode = (user.latency_mode === "standard"
      ? "standard"
      : "low") as "low" | "standard";
    const wantsSignedPlayback =
      (user.stream_privacy ?? "public") !== "public";
    const canSign = isSigningConfigured();

    // 1. Create the new Mux stream first. If this fails, leave the old one alone.
    let newStream: MuxStreamData;
    try {
      newStream = await createMuxStream({
        name: `${user.username} - ${user.creator?.streamTitle ?? "Stream"}`,
        record: enableRecording,
        latencyMode,
        withSignedPlayback: wantsSignedPlayback && canSign,
      });
    } catch (err) {
      console.error("[reprovision] create failed:", err);
      return NextResponse.json(
        { error: "Failed to create new Mux stream" },
        { status: 502 }
      );
    }

    // 2. Update DB with the new credentials + provisioning flags
    try {
      await sql`
        UPDATE users SET
          mux_stream_id = ${newStream.id},
          mux_playback_id = ${newStream.playbackId},
          mux_signed_playback_id = ${newStream.signedPlaybackId ?? null},
          streamkey = ${newStream.streamKey},
          mux_stream_provisioned_with_dvr = ${latencyMode === "standard"},
          mux_stream_provisioned_with_signed_playback = ${!!newStream.signedPlaybackId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;
    } catch (dbErr) {
      console.error("[reprovision] DB update failed:", dbErr);
      // Try to clean up the orphan Mux stream we just created
      void deleteMuxStream(newStream.id).catch(() => {});
      return NextResponse.json(
        { error: "Failed to save new stream credentials" },
        { status: 500 }
      );
    }

    // 3. Best-effort cleanup of the old Mux stream. Don't fail the request if it errors.
    if (user.mux_stream_id) {
      try {
        await deleteMuxStream(user.mux_stream_id);
      } catch (delErr) {
        console.warn(
          "[reprovision] failed to delete old Mux stream (will be orphaned):",
          delErr
        );
      }
    }

    return NextResponse.json({
      success: true,
      streamData: {
        streamKey: newStream.streamKey,
        playbackId: newStream.playbackId,
        rtmpUrl: newStream.rtmpUrl,
      },
      provisionedWith: {
        dvr: latencyMode === "standard",
        signedPlayback: !!newStream.signedPlaybackId,
      },
      warnings:
        wantsSignedPlayback && !canSign
          ? [
              "Mux signing keys not configured — privacy is enforced at the app layer only. Set MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE to enable CDN-level privacy.",
            ]
          : [],
    });
  } catch (err) {
    console.error("[reprovision] unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to reprovision stream" },
      { status: 500 }
    );
  }
}
