/**
 * GET /api/routes-f/moderation-audit-log
 *
 * Returns a paginated audit log of moderator actions for a channel (bans,
 * unbans, timeouts, mod-team changes, message deletions, appeal decisions).
 * Read-only surface over the in-memory audit store — other moderation
 * routes are expected to call logModerationAction() as those actions occur.
 *
 * Auth: caller must be signed in (verifySession) AND be a moderator or
 * owner of `creator_id` (checked against the mod-team store) — audit logs
 * expose moderator identities and reasons, so they're restricted to the
 * channel's own mod team, same as moderation-shared-ban-list.
 *
 * Query params:
 *   creator_id — required. The channel whose audit log to fetch.
 *   action     — optional. Filter to a single ModerationActionType.
 *   page       — optional. 1-indexed page number (default 1).
 *   limit      — optional. Page size, 1-100 (default 20).
 *
 * Response 200:
 *   {
 *     entries: Array<{ id, creator_id, moderator_id, action, target_viewer_id, reason, created_at }>,
 *     total: number,
 *     page: number,
 *     limit: number,
 *     has_more: boolean
 *   }
 *
 * Error responses:
 *   400 — invalid/missing query params
 *   401 — unauthorized (no valid session)
 *   403 — caller is not a moderator/owner of creator_id
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { modStore } from "@/app/api/routes-f/mod-team/route";
import { listAuditLog } from "./store";
import type { ModerationActionType } from "./types";

const ACTION_TYPES: [ModerationActionType, ...ModerationActionType[]] = [
  "ban",
  "unban",
  "timeout",
  "mod_add",
  "mod_remove",
  "message_delete",
  "appeal_accept",
  "appeal_reject",
];

function storeKey(creator_id: string, viewer_id: string): string {
  return `${creator_id}:${viewer_id}`;
}

function isModerator(userId: string, creatorId: string): boolean {
  if (userId === creatorId) {
    return true;
  }
  return modStore.has(storeKey(creatorId, userId));
}

const querySchema = z.object({
  creator_id: z.string().trim().min(1, "creator_id is required"),
  action: z.enum(ACTION_TYPES).optional(),
  page: z
    .string()
    .optional()
    .transform(v => (v !== undefined ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1, "page must be 1 or greater")),
  limit: z
    .string()
    .optional()
    .transform(v => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100, "limit must be between 1 and 100")),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = await validateQuery(req, querySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { creator_id, action, page, limit } = queryResult.data;

  if (!isModerator(session.userId, creator_id)) {
    return NextResponse.json(
      { error: "Only moderators can view this channel's audit log." },
      { status: 403 }
    );
  }

  const result = listAuditLog({ creator_id, page, limit, action });

  return NextResponse.json(result);
}
