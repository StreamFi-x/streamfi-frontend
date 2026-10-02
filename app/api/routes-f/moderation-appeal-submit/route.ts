/**
 * POST /api/routes-f/moderation-appeal-submit
 *
 * Lets an authenticated, banned viewer submit an appeal against a channel
 * ban, along with a message explaining their case. The caller must be
 * signed in (verifySession) and the appeal is always filed on behalf of the
 * caller's own user id — a viewer cannot file an appeal for someone else.
 * The viewer must actually be banned on the channel (directly, or via a
 * shared ban list they subscribe to — see ban-sync/store) before an appeal
 * can be filed; this does not require an ownership check because a banned
 * viewer is, by definition, not the channel owner.
 *
 * Request body:
 *   {
 *     creator_id: string,   // the channel the ban applies to
 *     ban_id?: string,      // optional — identifies the specific ban record
 *     message: string       // the viewer's appeal message (max 1000 chars)
 *   }
 *
 * Response 201:
 *   { appeal_id: string, status: "pending", created_at: string }
 *
 * Error responses:
 *   400 — invalid JSON body / missing or malformed fields / message too long /
 *         creator_id equals the caller's own id
 *   401 — unauthorized (no valid session)
 *   403 — caller is not currently banned on this channel
 *   409 — a pending appeal already exists for this viewer on this channel
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/verify-session";
import { isViewerBannedOnChannel } from "@/app/api/routes-f/ban-sync/store";
import { submitAppeal } from "./store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { creator_id, ban_id, message } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof creator_id !== "string" || !creator_id.trim()) {
    return NextResponse.json(
      { error: "creator_id is required." },
      { status: 400 }
    );
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "message is required." },
      { status: 400 }
    );
  }
  if (ban_id !== undefined && typeof ban_id !== "string") {
    return NextResponse.json(
      { error: "ban_id must be a string when provided." },
      { status: 400 }
    );
  }

  const viewer_id = session.userId;

  if (creator_id === viewer_id) {
    return NextResponse.json(
      { error: "A creator cannot submit an appeal against their own channel." },
      { status: 400 }
    );
  }

  if (!isViewerBannedOnChannel(creator_id, viewer_id)) {
    return NextResponse.json(
      { error: "You are not currently banned on this channel." },
      { status: 403 }
    );
  }

  const result = submitAppeal({
    creator_id,
    viewer_id,
    ban_id: ban_id as string | undefined,
    message,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.result, { status: 201 });
}
