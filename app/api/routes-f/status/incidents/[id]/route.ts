import { NextRequest, NextResponse } from "next/server";
import { updateIncident, validateIncidentUpdateInput } from "../../_lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = validateIncidentUpdateInput(body);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  try {
    const { id } = await params;
    const incident = await updateIncident(id, input);
    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(incident);
  } catch (error) {
    console.error("[routes-f status incidents PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }
}
