import { NextResponse } from "next/server";
import { REACTIONS } from "./_lib/reactions";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    allowed_reactions: REACTIONS,
  });
}
