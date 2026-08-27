/**
 * POST /api/routes-f/stream-collab-invite-create
 * A creator invites another creator to collaborate on a stream. Returns
 * the created invite along with a signed invite link — the link's token
 * is a signed reference to the invite_id, so the recipient can accept or
 * decline without needing to already be authenticated with the platform's
 * normal session flow (e.g. clicking the link from a DM/email).
 */
import { NextRequest, NextResponse } from "next/server";
import type { CreateInviteBody, CreateInviteResponse } from "./types";
import { createInvite, SelfInviteError } from "./store";
import { signToken } from "@/lib/auth/sign-token";

const INVITE_LINK_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreateInviteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { from_creator_id, to_creator_id, stream_id } = body;

  if (!from_creator_id || typeof from_creator_id !== "string") {
    return NextResponse.json(
      { error: "from_creator_id is required" },
      { status: 400 }
    );
  }
  if (!to_creator_id || typeof to_creator_id !== "string") {
    return NextResponse.json(
      { error: "to_creator_id is required" },
      { status: 400 }
    );
  }
  if (!stream_id || typeof stream_id !== "string") {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      "[routes-f stream-collab-invite-create] SESSION_SECRET not configured"
    );
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  try {
    const invite = createInvite(from_creator_id, to_creator_id, stream_id);

    const exp = Math.floor(Date.now() / 1000) + INVITE_LINK_TTL_SECONDS;
    const token = signToken(
      { inviteId: invite.invite_id, purpose: "collab_invite", exp },
      secret
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const invite_link = `${baseUrl}/collab/invite?token=${encodeURIComponent(token)}`;

    return NextResponse.json(
      { invite, invite_link } as CreateInviteResponse,
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SelfInviteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
