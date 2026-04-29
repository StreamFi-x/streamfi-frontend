import { NextResponse } from "next/server";
import { buildStatusResponse } from "./_lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await buildStatusResponse());
  } catch (error) {
    console.error("[routes-f status GET]", error);
    return NextResponse.json(
      { error: "Failed to build platform status" },
      { status: 500 }
    );
  }
}
