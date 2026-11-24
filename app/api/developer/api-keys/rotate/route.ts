import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { rotateApiKey } from "@/lib/api-keys";

/**
 * POST /api/developer/api-keys/rotate
 * Body: { id: string }
 * Revokes the old key and generates a new key immediately.
 */
export async function POST(req: NextRequest) {
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

    const result = await rotateApiKey(session.userId, id);

    return NextResponse.json(
      {
        apiKey: result.apiKey,
        key: result.rawKey,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to rotate API key";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Rotate API key error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
