import { NextRequest, NextResponse } from "next/server";
import {
  PUSH_PLATFORMS,
  type DeleteTokenBody,
  type PushPlatform,
  type RegisterTokenBody,
  type RegisterTokenResponse,
} from "./types";
import { registerToken, removeByTokenId, removeByViewerPlatform } from "./store";

function isValidPlatform(value: unknown): value is PushPlatform {
  return (
    typeof value === "string" &&
    PUSH_PLATFORMS.includes(value as PushPlatform)
  );
}

/**
 * POST /api/routes-f/push-token
 * Body: { viewer_id, platform: ios|android|web, token } -> { token_id }
 *
 * Registers a viewer's push token. Tokens are deduplicated per viewer+platform:
 * re-registering for the same pair replaces the token value but reuses the
 * existing token_id.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RegisterTokenBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { viewer_id, platform, token } = body;

  if (!viewer_id || typeof viewer_id !== "string") {
    return NextResponse.json(
      { error: "viewer_id is required" },
      { status: 400 }
    );
  }
  if (!isValidPlatform(platform)) {
    return NextResponse.json(
      { error: "platform must be one of: ios, android, web" },
      { status: 400 }
    );
  }
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const { record, replaced } = registerToken(viewer_id, platform, token);
  return NextResponse.json(
    { token_id: record.token_id } as RegisterTokenResponse,
    { status: replaced ? 200 : 201 }
  );
}

/**
 * DELETE /api/routes-f/push-token
 * Body: { token_id } OR { viewer_id, platform } -> { removed: boolean }
 *
 * Removes a registered token either by its token_id or by viewer+platform.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: DeleteTokenBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { token_id, viewer_id, platform } = body;

  if (token_id) {
    if (typeof token_id !== "string") {
      return NextResponse.json(
        { error: "token_id must be a string" },
        { status: 400 }
      );
    }
    return NextResponse.json({ removed: removeByTokenId(token_id) });
  }

  if (viewer_id || platform) {
    if (!viewer_id || typeof viewer_id !== "string") {
      return NextResponse.json(
        { error: "viewer_id is required" },
        { status: 400 }
      );
    }
    if (!isValidPlatform(platform)) {
      return NextResponse.json(
        { error: "platform must be one of: ios, android, web" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      removed: removeByViewerPlatform(viewer_id, platform),
    });
  }

  return NextResponse.json(
    { error: "provide token_id, or viewer_id and platform" },
    { status: 400 }
  );
}
