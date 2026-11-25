import { NextRequest, NextResponse } from "next/server";
import { createSanitizedErrorResponse } from '@/lib/api/error-response';
import { verifySession } from "@/lib/auth/verify-session";
import { rotateApiKey } from "@/lib/api-keys/service";

/**
 * POST /api/developer/keys/rotate
 * Body: { keyId: string }
 * Immediately revokes the specified key and generates a replacement key.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json();
    const { keyId } = body ?? {};

    if (!keyId || typeof keyId !== "string") {
      return NextResponse.json(
        { error: "keyId is required" },
        { status: 400 }
      );
    }

    const result = await rotateApiKey(session.userId, keyId);

    return NextResponse.json({
      message:
        "API key rotated successfully. The previous key has been revoked immediately.",
      oldKeyId: result.oldKeyId,
      newApiKey: result.newApiKey,
      secretKey: result.secretKey,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }
    return createSanitizedErrorResponse(error, {
      context: 'developer/keys/rotate POST',
      publicMessage: 'Failed to rotate API key',
    });
  }
}
