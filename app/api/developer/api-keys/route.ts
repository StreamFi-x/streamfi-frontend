import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  ApiKeyTier,
} from "@/lib/api-keys";

/**
 * GET /api/developer/api-keys
 * Returns all API keys for the authenticated user (metadata only, no secrets).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const keys = await listApiKeys(session.userId);
    return NextResponse.json({ keys }, { status: 200 });
  } catch (error) {
    console.error("List API keys error:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/developer/api-keys
 * Creates a new API key tied to the authenticated user's account.
 * Body: { name: string, tier?: "free" | "creator" | "partner" }
 * Plaintext secret is returned ONLY upon creation.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const body = await req.json().catch(() => ({}));
    const { name, tier = "free" } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "API key name is required" },
        { status: 400 }
      );
    }

    if (!["free", "creator", "partner"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid API key tier" },
        { status: 400 }
      );
    }

    const result = await createApiKey(session.userId, name, tier as ApiKeyTier);

    return NextResponse.json(
      {
        apiKey: result.apiKey,
        key: result.rawKey,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create API key";
    if (message.includes("Maximum number of active API keys")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    console.error("Create API key error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/developer/api-keys
 * Revokes an API key immediately.
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session.ok) {
      return session.response;
    }

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "API key ID is required" },
        { status: 400 }
      );
    }

    const revoked = await revokeApiKey(session.userId, id);
    if (!revoked) {
      return NextResponse.json(
        { error: "API key not found or already revoked" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: "API key revoked successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Revoke API key error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
