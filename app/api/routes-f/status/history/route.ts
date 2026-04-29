import { NextResponse } from "next/server";
import { buildHistoryResponse } from "../_lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await buildHistoryResponse());
  } catch (error) {
    console.error("[routes-f status history GET]", error);
    return NextResponse.json(
      { error: "Failed to build incident history" },
      { status: 500 }
    );
  }
}
