import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { getOptionalSession } from "@/app/api/routes-f/_lib/session";
import {
  enforceReactionRateLimit,
  getReactionSummary,
  incrementReaction,
  reactionEmojiSchema,
} from "../_lib/reactions";
import { z } from "zod";

const reactionBodySchema = z.object({
  emoji: reactionEmojiSchema,
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
): Promise<NextResponse> {
  const { streamId } = await params;

  try {
    const summary = await getReactionSummary(streamId);
    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "public, max-age=2, stale-while-revalidate=2",
      },
    });
  } catch (error) {
    console.error("[routes-f reactions/:streamId GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch reactions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> }
): Promise<NextResponse> {
  const { streamId } = await params;
  const bodyResult = await validateBody(req, reactionBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    const session = await getOptionalSession(req);
    const isLimited = await enforceReactionRateLimit(
      req,
      streamId,
      session?.userId ?? null
    );

    if (isLimited) {
      return NextResponse.json(
        { error: "Too many reactions. Please slow down." },
        { status: 429, headers: { "Retry-After": "10" } }
      );
    }

    await incrementReaction(streamId, bodyResult.data.emoji);
    const summary = await getReactionSummary(streamId);

    return NextResponse.json(
      {
        ok: true,
        emoji: bodyResult.data.emoji,
        reactions: summary.reactions,
        total: summary.total,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f reactions/:streamId POST]", error);
    return NextResponse.json(
      { error: "Failed to record reaction" },
      { status: 500 }
    );
  }
}
