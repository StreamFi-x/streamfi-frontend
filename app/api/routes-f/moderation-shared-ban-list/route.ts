/**
 * GET  /api/routes-f/moderation-shared-ban-list?creator_id=...
 * PUT  /api/routes-f/moderation-shared-ban-list
 *
 * Lets a channel subscribe to another channel's shared ban list, so a viewer
 * banned on the source channel is treated as banned on the subscribing
 * (target) channel too. Backed by the existing ban-sync in-memory store —
 * this route is the moderator-facing surface over the same subscription
 * data used internally by ban-sync/isViewerBannedOnChannel.
 *
 * Auth: caller must be signed in (verifySession) AND be a moderator or
 * owner of `creator_id` (checked against the mod-team store). This is a
 * moderation-configuration action, not something any viewer can trigger.
 *
 * GET query params:
 *   creator_id — required. The channel whose subscription status to read.
 *
 * GET response 200:
 *   { subscribed_to: string[], subscribed_by: string[] }
 *
 * PUT request body:
 *   {
 *     creator_id: string,        // the channel subscribing (target)
 *     source_creator_id: string, // the channel whose ban list to follow
 *     copy_existing?: boolean    // also import the source's current bans
 *   }
 *
 * PUT response 200:
 *   { subscribed_to: string[], subscribed_by: string[] }
 *
 * Error responses:
 *   400 — invalid body/query, or source_creator_id === creator_id
 *   401 — unauthorized (no valid session)
 *   403 — caller is not a moderator/owner of creator_id
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { modStore } from "@/app/api/routes-f/mod-team/route";
import {
  getBanSyncStatus,
  subscribeToBans,
} from "@/app/api/routes-f/ban-sync/store";

function storeKey(creator_id: string, viewer_id: string): string {
  return `${creator_id}:${viewer_id}`;
}

function isModerator(userId: string, creatorId: string): boolean {
  // A creator is implicitly authorized over their own channel even before
  // any mod-team row exists for them.
  if (userId === creatorId) {
    return true;
  }
  return modStore.has(storeKey(creatorId, userId));
}

const getQuerySchema = z.object({
  creator_id: z.string().trim().min(1, "creator_id is required"),
});

const putBodySchema = z.object({
  creator_id: z.string().trim().min(1, "creator_id is required"),
  source_creator_id: z.string().trim().min(1, "source_creator_id is required"),
  copy_existing: z.boolean().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, getQuerySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { creator_id } = queryResult.data;

  if (!isModerator(session.userId, creator_id)) {
    return NextResponse.json(
      {
        error:
          "Only moderators can view this channel's shared ban list settings.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json(getBanSyncStatus(creator_id));
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, putBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { creator_id, source_creator_id, copy_existing } = bodyResult.data;

  if (!isModerator(session.userId, creator_id)) {
    return NextResponse.json(
      {
        error:
          "Only moderators can manage this channel's shared ban list subscriptions.",
      },
      { status: 403 }
    );
  }

  const result = subscribeToBans({
    source_creator_id,
    target_creator_id: creator_id,
    copy_existing,
  });

  // PUT is idempotent — an existing subscription is not an error, it's the
  // already-satisfied desired state.
  if (!result.ok && result.status !== 409) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(getBanSyncStatus(creator_id));
}
