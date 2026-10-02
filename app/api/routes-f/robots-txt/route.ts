import { type NextRequest, NextResponse } from "next/server";
import { buildRobotsTxt } from "./_lib/helpers";
import type { RobotsResponse } from "./_lib/types";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const robotsTxt = buildRobotsTxt(body);
    return NextResponse.json({ robots_txt: robotsTxt } satisfies RobotsResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build robots.txt.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
