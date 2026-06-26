import { NextRequest, NextResponse } from "next/server";
import type { PatchPanelBody } from "../types";
import { findPanel, updatePanel, deletePanel } from "../store";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ panel_id: string }> }
): Promise<NextResponse> {
  const { panel_id } = await context.params;

  let body: PatchPanelBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { title, body_markdown, image_url } = body;

  if (
    title === undefined &&
    body_markdown === undefined &&
    image_url === undefined
  ) {
    return NextResponse.json(
      { error: "At least one field to update is required" },
      { status: 400 }
    );
  }

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    return NextResponse.json(
      { error: "title must be a non-empty string" },
      { status: 400 }
    );
  }
  if (
    body_markdown !== undefined &&
    (typeof body_markdown !== "string" || body_markdown.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "body_markdown must be a non-empty string" },
      { status: 400 }
    );
  }
  if (image_url !== undefined && image_url !== null && typeof image_url !== "string") {
    return NextResponse.json(
      { error: "image_url must be a string or null" },
      { status: 400 }
    );
  }

  if (!findPanel(panel_id)) {
    return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  }

  const updated = updatePanel(panel_id, { title, body_markdown, image_url });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ panel_id: string }> }
): Promise<NextResponse> {
  const { panel_id } = await context.params;

  const removed = deletePanel(panel_id);
  if (!removed) {
    return NextResponse.json({ error: "Panel not found" }, { status: 404 });
  }

  return NextResponse.json({ removed: true });
}
