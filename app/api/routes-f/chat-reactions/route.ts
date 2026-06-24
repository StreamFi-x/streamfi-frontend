import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "../../_lib/validate";
import { z } from "zod";
import {
  toggleReaction,
  getReactionsForMessage,
  validateReactionInput,
} from "./utils";
import type {
  PostReactionRequestBody,
  PostReactionResponse,
  ReactionResponse,
} from "./types";

const reactionSchema = z.object({
  message_id: z.string(),
  emoji: z.string(),
  user_id: z.string(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, reactionSchema);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const body = validation.data as PostReactionRequestBody;

  const inputValidation = validateReactionInput(
    body.message_id,
    body.emoji,
    body.user_id
  );
  if (!inputValidation.valid) {
    return NextResponse.json({ error: inputValidation.error }, { status: 400 });
  }

  // Toggle reaction
  const toggled = toggleReaction(body.message_id, body.emoji, body.user_id);

  // Get updated reactions
  const reactions = getReactionsForMessage(body.message_id, body.user_id);

  return NextResponse.json({
    toggled,
    reactions,
  } as PostReactionResponse);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const messageId = new URL(req.url).searchParams.get("message_id");
  const currentUserId = new URL(req.url).searchParams.get("user_id");

  if (!messageId) {
    return NextResponse.json(
      { error: "message_id is required" },
      { status: 400 }
    );
  }

  const reactions = getReactionsForMessage(
    messageId,
    currentUserId || undefined
  );

  return NextResponse.json({
    reactions,
  } as ReactionResponse);
}
