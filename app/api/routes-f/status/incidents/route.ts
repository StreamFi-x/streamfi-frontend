import { NextRequest, NextResponse } from "next/server";
import { createIncident, validateIncidentInput } from "../_lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = validateIncidentInput(body);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  try {
    return NextResponse.json(await createIncident(input), { status: 201 });
  } catch (error) {
    console.error("[routes-f status incidents POST]", error);
    return NextResponse.json(
      { error: "Failed to create incident" },
      { status: 500 }
    );
  }
}
