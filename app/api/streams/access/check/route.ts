import { NextResponse } from "next/server";
import { checkStreamAccess } from "@/lib/stream/access";

/**
 * Endpoint to check if a viewer has access to a stream.
 * Called by the client before rendering the StreamPlayer.
 *
 * Request:
 * { "streamer_username": "alice", "viewer_public_key": "GABC..." }
 *
 * Response (allowed):
 * { "allowed": true }
 *
 * Response (blocked):
 * { "allowed": false, "reason": "paid", "price_usdc": "10.00" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { streamer_username, viewer_public_key } = body;

    if (!streamer_username) {
      return NextResponse.json(
        { error: "Streamer username is required" },
        { status: 400 }
      );
    }

    const accessResult = await checkStreamAccess(
      streamer_username,
      viewer_public_key || null
    );

    if (accessResult.allowed) {
      return NextResponse.json({ allowed: true });
    }

    // Build response for blocked access
    const responseBody: any = {
      allowed: false,
      reason: accessResult.reason,
    };

    // Include config fields if available (e.g. price for paid streams)
    if (accessResult.config) {
      Object.assign(responseBody, accessResult.config);
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("API: Check stream access error:", error);
    return NextResponse.json(
      { error: "Failed to check stream access" },
      { status: 500 }
    );
  }
}
