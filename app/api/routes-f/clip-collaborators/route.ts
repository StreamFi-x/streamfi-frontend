/**
 * /api/routes-f/clip-collaborators
 *
 * POST { clip_id, collaborator_id, role } -> { added_at }: attribute a
 *   co-collaborator to a clip. Capped at 5 collaborators per clip; adding an
 *   already-present collaborator updates their role instead of counting
 *   against the cap again.
 * DELETE { clip_id, collaborator_id }: remove a collaboration.
 * GET ?clip_id: list collaborators for a clip, oldest first.
 */
import { NextRequest, NextResponse } from "next/server";
import type {
  AddCollaboratorRequestBody,
  AddCollaboratorResponse,
  ListCollaboratorsResponse,
} from "./types";
import { CLIP_COLLABORATOR_ROLES } from "./types";
import {
  addCollaborator,
  removeCollaborator,
  listCollaborators,
  CollaboratorCapExceededError,
} from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AddCollaboratorRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { clip_id, collaborator_id, role } = body;

  if (!clip_id || typeof clip_id !== "string") {
    return NextResponse.json(
      { error: "clip_id is required" },
      { status: 400 }
    );
  }
  if (!collaborator_id || typeof collaborator_id !== "string") {
    return NextResponse.json(
      { error: "collaborator_id is required" },
      { status: 400 }
    );
  }
  if (!role || !CLIP_COLLABORATOR_ROLES.includes(role)) {
    return NextResponse.json(
      {
        error: `role must be one of: ${CLIP_COLLABORATOR_ROLES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const collaborator = addCollaborator({ clip_id, collaborator_id, role });
    return NextResponse.json({
      added_at: collaborator.added_at,
    } as AddCollaboratorResponse);
  } catch (error) {
    if (error instanceof CollaboratorCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: { clip_id?: string; collaborator_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { clip_id, collaborator_id } = body;

  if (!clip_id || typeof clip_id !== "string") {
    return NextResponse.json(
      { error: "clip_id is required" },
      { status: 400 }
    );
  }
  if (!collaborator_id || typeof collaborator_id !== "string") {
    return NextResponse.json(
      { error: "collaborator_id is required" },
      { status: 400 }
    );
  }

  const removed = removeCollaborator(clip_id, collaborator_id);
  if (!removed) {
    return NextResponse.json(
      { error: "Collaboration not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ message: "Collaborator removed" });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get("clip_id");

  if (!clipId) {
    return NextResponse.json(
      { error: "clip_id is required" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    clip_id: clipId,
    collaborators: listCollaborators(clipId),
  } as ListCollaboratorsResponse);
}
