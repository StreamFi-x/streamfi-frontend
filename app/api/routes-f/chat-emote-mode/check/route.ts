import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkMessageSchema = z.object({
  message: z.string(),
});

function isEmoteOnly(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) return false;

  for (const char of trimmed) {
    const code = char.codePointAt(0);
    if (!code) continue;

    if (code < 0x1F000) {
      if (!/[\p{Emoji}]/u.test(char)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * POST /api/routes-f/chat-emote-mode/check
 * Check if a message would be blocked by emote-only mode
 */
export async function POST(req: NextRequest) {
  const bodyResult = await validateBody(req, checkMessageSchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { message } = bodyResult.data;
  const isEmote = isEmoteOnly(message);

  return NextResponse.json({
    is_emote_only: isEmote,
    would_be_blocked: !isEmote,
  });
}
