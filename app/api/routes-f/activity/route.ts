import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { ensureActivitySchema } from "./_lib/db";
import {
  FILTER_TO_TYPES,
  type ActivityTypeFilter,
  type ActivityEvent,
  type ActivityFeedResponse,
} from "@/types/activity";

const VALID_FILTERS = Object.keys(FILTER_TO_TYPES) as ActivityTypeFilter[];

const activityQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  type: z
    .string()
    .default("all")
    .refine((v): v is ActivityTypeFilter => VALID_FILTERS.includes(v as ActivityTypeFilter), {
      message: `type must be one of: ${VALID_FILTERS.join(", ")}`,
    }),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const queryResult = validateQuery(
    req.nextUrl.searchParams,
    activityQuerySchema,
  );
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { limit, cursor, type } = queryResult.data;
  const typeFilter = FILTER_TO_TYPES[type as ActivityTypeFilter];

  try {
    await ensureActivitySchema();

    // Fetch limit + 1 rows to detect whether there is a next page
    const fetchLimit = limit + 1;

    let result;

    if (cursor && typeFilter) {
      result = await sql`
        SELECT
          ae.id, ae.type, ae.metadata, ae.created_at,
          u.username AS actor_username,
          u.avatar   AS actor_avatar
        FROM route_f_activity_events ae
        LEFT JOIN users u ON u.id = ae.actor_id
        WHERE ae.user_id = ${session.userId}
          AND ae.created_at < ${cursor}
          AND ae.type = ANY(${typeFilter})
        ORDER BY ae.created_at DESC
        LIMIT ${fetchLimit}
      `;
    } else if (cursor) {
      result = await sql`
        SELECT
          ae.id, ae.type, ae.metadata, ae.created_at,
          u.username AS actor_username,
          u.avatar   AS actor_avatar
        FROM route_f_activity_events ae
        LEFT JOIN users u ON u.id = ae.actor_id
        WHERE ae.user_id = ${session.userId}
          AND ae.created_at < ${cursor}
        ORDER BY ae.created_at DESC
        LIMIT ${fetchLimit}
      `;
    } else if (typeFilter) {
      result = await sql`
        SELECT
          ae.id, ae.type, ae.metadata, ae.created_at,
          u.username AS actor_username,
          u.avatar   AS actor_avatar
        FROM route_f_activity_events ae
        LEFT JOIN users u ON u.id = ae.actor_id
        WHERE ae.user_id = ${session.userId}
          AND ae.type = ANY(${typeFilter})
        ORDER BY ae.created_at DESC
        LIMIT ${fetchLimit}
      `;
    } else {
      result = await sql`
        SELECT
          ae.id, ae.type, ae.metadata, ae.created_at,
          u.username AS actor_username,
          u.avatar   AS actor_avatar
        FROM route_f_activity_events ae
        LEFT JOIN users u ON u.id = ae.actor_id
        WHERE ae.user_id = ${session.userId}
        ORDER BY ae.created_at DESC
        LIMIT ${fetchLimit}
      `;
    }

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const events: ActivityEvent[] = pageRows.map((row) => ({
      id: row.id,
      type: row.type,
      actor:
        row.actor_username != null
          ? { username: row.actor_username, avatar: row.actor_avatar }
          : null,
      metadata: row.metadata ?? null,
      created_at: new Date(row.created_at).toISOString(),
    }));

    const next_cursor = hasMore
      ? new Date(pageRows[pageRows.length - 1].created_at).toISOString()
      : null;

    const body: ActivityFeedResponse = { events, next_cursor };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[activity] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
