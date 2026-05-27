import { NextResponse } from "next/server";

/**
 * Base /api/routes-f/presence
 * Redirects to stream-specific endpoints.
 * All viewer presence operations are stream-scoped at /presence/[streamId].
 */
export async function GET() {
  return NextResponse.json({
    message: "Use /api/routes-f/presence/[streamId] for stream-specific viewer counts.",
  });
}
