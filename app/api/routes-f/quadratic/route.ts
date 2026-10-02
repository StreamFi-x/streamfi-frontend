import { type NextRequest, NextResponse } from "next/server";
import { solveQuadratic } from "./_lib/helpers";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(solveQuadratic(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to solve quadratic.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
