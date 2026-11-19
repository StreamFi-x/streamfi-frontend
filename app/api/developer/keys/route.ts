import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from "@/lib/api-keys/service";
import { ApiKeyTier } from "@/lib/api-keys/types";

/**
 * GET /api/developer/keys
 * List all API keys for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const keys = await listApiKeys(session.userId);
    return NextResponse.json({ keys });
  } catch (error) {
    console.error("[developer/keys] GET error:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/developer/keys
 * Generate a new API key for the authenticated user.
 * Body: { name: string, tier?: "free" | "creator" | "pro" | "enterprise" }
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json();
    const { name, tier = "free" } = body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Key name is required" },
        { status: 400 }
      );
    }

    const validTiers: ApiKeyTier[] = ["free", "creator", "pro", "enterprise"];
    if (tier && !validTiers.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await createApiKey(session.userId, name, tier);

    return NextResponse.json(
      {
        message:
          "API key created successfully. Save your secret key now — it will not be shown again.",
        apiKey: result.apiKey,
        secretKey: result.secretKey,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[developer/keys] POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create API key";
    const status = message.includes("limit reached") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/developer/keys
 * Revoke an API key immediately.
 * Body: { keyId: string } or Query: ?keyId=xxx
 */
export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    let keyId: string | null = null;

    const { searchParams } = new URL(req.url);
    keyId = searchParams.get("keyId");

    if (!keyId && req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      keyId = body?.keyId ?? null;
    }

    if (!keyId) {
      return NextResponse.json(
        { error: "keyId is required" },
        { status: 400 }
      );
    }

    const revokedKey = await revokeApiKey(session.userId, keyId);

    return NextResponse.json({
      message: "API key revoked successfully",
      apiKey: revokedKey,
    });
  } catch (error) {
    console.error("[developer/keys] DELETE error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to revoke API key";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
