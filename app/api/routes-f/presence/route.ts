import { NextResponse } from "next/server";

// Placeholder index route — individual stream presence is at /presence/[streamId]
export async function GET() {
  return NextResponse.json(
    {
      message:
        "Use /api/routes-f/presence/[streamId] to get viewer count for a specific stream.",
    },
    { status: 200 }
  );
}
