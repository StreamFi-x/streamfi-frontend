/**
 * POST /api/streams/chat/typing
 *
 * Publishes an ephemeral "user is typing" signal on `stream:{playbackId}:typing`.
 * Nothing is written to `chat_messages` or any other table. Whether the event
 * reaches the room is decided by decideTypingBroadcast (lib/chat-typing.ts).
 *
 * Suppressed events still answer 202 with `{ broadcast: false, reason }` so the
 * client does not retry, and are never an error: typing is cosmetic.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { createRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { publishRealtimeMessage } from "@/lib/realtime/pubsub";
import { getLivePresence } from "@/lib/realtime/presence";
import { getSpikeLevelForStream } from "@/lib/chat-spike";
import {
  TYPING_EVENT,
  TYPING_SAMPLED_ROOM_LIMIT,
  TYPING_SAMPLED_ROOM_WINDOW_MS,
  TYPING_USER_LIMIT,
  TYPING_USER_WINDOW_MS,
  decideTypingBroadcast,
  typingChannel,
  type TypingEventPayload,
  type TypingState,
} from "@/lib/chat-typing";
import { isTimedOut } from "@/app/api/routes-f/stream/chat-timeout/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const userLimiter = createRateLimit({
  namespace: "chat-typing-user",
  limit: TYPING_USER_LIMIT,
  windowMs: TYPING_USER_WINDOW_MS,
});

const roomLimiter = createRateLimit({
  namespace: "chat-typing-room",
  limit: TYPING_SAMPLED_ROOM_LIMIT,
  windowMs: TYPING_SAMPLED_ROOM_WINDOW_MS,
});

const STATES: TypingState[] = ["typing", "stopped"];

async function getViewerCount(streamerId: string): Promise<number> {
  try {
    const presence = await getLivePresence(streamerId, { limit: 1 });
    return presence.totalViewers;
  } catch {
    // Unknown audience size: treat as small so typing keeps working.
    return 0;
  }
}

/** Milliseconds until the user may send under slow mode; 0 when free to send. */
async function getSlowModeRemainingMs(
  userId: string,
  streamerId: string,
  slowModeSeconds: number
): Promise<number> {
  if (!slowModeSeconds || slowModeSeconds <= 0) {
    return 0;
  }
  const result = await sql`
    SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - cm.created_at)) * 1000 AS elapsed_ms
    FROM chat_messages cm
    JOIN stream_sessions ss ON ss.id = cm.stream_session_id
    WHERE cm.user_id = ${userId}
      AND ss.user_id = ${streamerId}
      AND ss.ended_at IS NULL
    ORDER BY cm.created_at DESC
    LIMIT 1
  `;
  if (result.rows.length === 0) {
    return 0;
  }
  return Math.max(0, slowModeSeconds * 1000 - Number(result.rows[0].elapsed_ms));
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const { playbackId, state } = await req.json();

    if (typeof playbackId !== "string" || !playbackId) {
      return NextResponse.json(
        { error: "Playback ID is required" },
        { status: 400 }
      );
    }
    if (!STATES.includes(state)) {
      return NextResponse.json(
        { error: "state must be 'typing' or 'stopped'" },
        { status: 400 }
      );
    }

    const userLimit = await userLimiter.check(`${session.userId}:${playbackId}`);
    if (!userLimit.success) {
      return tooManyRequests(userLimit, "Typing events sent too quickly");
    }

    const result = await sql`
      SELECT
        sender.username AS sender_username,
        sender.wallet AS sender_wallet,
        streamer.id AS streamer_id,
        streamer.is_live,
        streamer.creator->>'chatSlowModeSeconds' AS chat_slow_mode_seconds
      FROM users sender
      CROSS JOIN users streamer
      WHERE sender.id = ${session.userId}
        AND streamer.mux_playback_id = ${playbackId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "User or stream not found" },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    if (!row.is_live) {
      return NextResponse.json({ broadcast: false, reason: "offline" }, { status: 202 });
    }

    const streamerId = String(row.streamer_id);
    const typing = state === "typing";

    const [spikeLevel, viewerCount, slowModeRemainingMs] = await Promise.all([
      getSpikeLevelForStream(streamerId),
      getViewerCount(streamerId),
      typing
        ? getSlowModeRemainingMs(
            session.userId,
            streamerId,
            Number(row.chat_slow_mode_seconds) || 0
          )
        : Promise.resolve(0),
    ]);

    // The room budget is spent only when it can matter: a "typing" event in
    // the sampled tier. Smaller rooms never touch it.
    const roomBudgetAvailable = typing
      ? (await roomLimiter.check(playbackId)).success
      : true;

    const decision = decideTypingBroadcast({
      state,
      spikeLevel,
      viewerCount,
      isTimedOut:
        isTimedOut(streamerId, session.userId) ||
        isTimedOut(playbackId, session.userId),
      slowModeRemainingMs,
      roomBudgetAvailable,
    });

    if (!decision.broadcast) {
      return NextResponse.json(
        { broadcast: false, reason: decision.reason },
        { status: 202 }
      );
    }

    const payload: TypingEventPayload = {
      state,
      username: row.sender_username,
      wallet: row.sender_wallet,
    };
    await publishRealtimeMessage(typingChannel(playbackId), TYPING_EVENT, payload);

    return NextResponse.json({ broadcast: true }, { status: 202 });
  } catch (error) {
    console.error("[chat-typing] Failed to publish typing event:", error);
    return NextResponse.json(
      { error: "Failed to publish typing event" },
      { status: 500 }
    );
  }
}
