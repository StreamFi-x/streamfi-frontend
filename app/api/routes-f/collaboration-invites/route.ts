import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import {
  createInvite,
  hasPendingInvite,
  respondToInvite,
  listInvitesForCreator,
  getInviteById,
} from "./store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Schemas
const createInviteSchema = z.object({
  from_creator_id: z.string().min(1, "from_creator_id is required"),
  to_creator_id: z.string().min(1, "to_creator_id is required"),
  stream_id: z.string().min(1, "stream_id is required"),
  message: z.string().optional(),
});

const respondInviteSchema = z.object({
  invite_id: z.string().min(1, "invite_id is required"),
  decision: z.enum(["accept", "decline"]),
});

const listInvitesSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

// POST /api/routes-f/collaboration-invites - Create new invitation
export async function POST(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, createInviteSchema);
  if (validation instanceof NextResponse) return validation;

  const { from_creator_id, to_creator_id, stream_id, message } = validation.data;

  // Check for existing pending invitation
  if (hasPendingInvite(from_creator_id, to_creator_id)) {
    return NextResponse.json(
      {
        error: "A pending invitation already exists between these creators",
        code: "DUPLICATE_PENDING_INVITE",
      },
      { status: 409 }
    );
  }

  // Create the invitation
  const invite = createInvite(from_creator_id, to_creator_id, stream_id, message);

  return NextResponse.json({
    invite_id: invite.invite_id,
    status: invite.status,
  });
}

// POST /api/routes-f/collaboration-invites/respond - Respond to invitation
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(req, respondInviteSchema);
  if (validation instanceof NextResponse) return validation;

  const { invite_id, decision } = validation.data;

  const updatedInvite = respondToInvite(invite_id, decision);
  if (!updatedInvite) {
    return NextResponse.json(
      { error: "Invitation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    invite_id: updatedInvite.invite_id,
    status: updatedInvite.status,
  });
}

// GET /api/routes-f/collaboration-invites - List invitations for a creator
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const validation = validateQuery(url.searchParams, listInvitesSchema);
  if (validation instanceof NextResponse) return validation;

  const { creator_id } = validation.data;
  const { incoming, outgoing } = listInvitesForCreator(creator_id);

  return NextResponse.json({
    incoming,
    outgoing,
  });
}

// Helper endpoint for testing - get invite details
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const validation = await validateBody(
    req,
    z.object({ invite_id: z.string().min(1) })
  );
  if (validation instanceof NextResponse) return validation;

  const { invite_id } = validation.data;
  const invite = getInviteById(invite_id);

  if (!invite) {
    return NextResponse.json(
      { error: "Invitation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(invite);
}