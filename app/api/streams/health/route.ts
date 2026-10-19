import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { getMuxStreamHealth } from "@/lib/mux/server";

/**
 * GET /api/streams/health?streamId={streamId}
 * 
 * Retrieve real-time health status of a Mux live stream.
 * Requires a valid session to prevent unauthenticated polling abuse.
 * 
 * Returns:
 * - 200: { streamId, isActive, status, reconnectWindow, latencyMode, recentAssetId, createdAt }
 * - 401: Unauthorized (no valid session)
 * - 400: Missing or invalid streamId parameter
 * - 404: Stream not found
 * - 503: Mux service unavailable
 */
export async function GET(req: NextRequest) {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  // Get streamId from query params
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get("streamId");

  if (!streamId || typeof streamId !== "string" || streamId.trim() === "") {
    return NextResponse.json(
      { error: "Missing or invalid streamId parameter" },
      { status: 400 }
    );
  }

  try {
    const health = await getMuxStreamHealth(streamId);
    return NextResponse.json(health);
  } catch (error) {
    console.error("Failed to get stream health:", error);

    // Determine if this is a Mux service error or stream not found
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get stream health";

    if (errorMessage.includes("not found") || errorMessage.includes("404")) {
      return NextResponse.json(
        { error: "Stream not found", detail: errorMessage },
        { status: 404 }
      );
    }

    // For timeouts, circuit breaker, or other Mux unavailability
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("unavailable") ||
      errorMessage.includes("circuit")
    ) {
      return NextResponse.json(
        { error: "health_unavailable", detail: errorMessage },
        { status: 503 }
      );
    }

    // Generic service error
    return NextResponse.json(
      { error: "health_unavailable", detail: errorMessage },
      { status: 503 }
    );
  }
}
