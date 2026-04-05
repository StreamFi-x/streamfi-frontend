import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { ensureRoutesFSchema } from "../_lib/schema";

/**
 * GET /api/routes-f/privacy
 * Returns privacy settings for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    // Ensure schema and table exist
    await ensureRoutesFSchema();

    const { rows } = await sql`
      SELECT 
        show_in_viewer_list,
        show_watch_history,
        show_following_list,
        allow_collab_requests,
        searchable_by_email
      FROM user_privacy
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Return defaults if no entry exists yet
      return NextResponse.json({
        show_in_viewer_list: true,
        show_watch_history: false,
        show_following_list: true,
        allow_collab_requests: true,
        searchable_by_email: false,
      });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[privacy:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/routes-f/privacy
 * Partially update privacy settings for the authenticated user.
 */
export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Define allowed fields and their types
  const allowedFields: Record<string, string> = {
    show_in_viewer_list: "boolean",
    show_watch_history: "boolean",
    show_following_list: "boolean",
    allow_collab_requests: "boolean",
    searchable_by_email: "boolean",
  };

  const updates: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key in allowedFields) {
      if (typeof value !== allowedFields[key]) {
        return NextResponse.json(
          { error: `Invalid type for ${key}. Expected ${allowedFields[key]}.` },
          { status: 400 }
        );
      }
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  try {
    await ensureRoutesFSchema();

    // Upsert the privacy settings
    // Since we're using Postgres, we can use INSERT ... ON CONFLICT

    // We'll use a transaction or a single robust query
    // Simple approach: UPSERT with defaults for missing columns

    const { rows } = await sql`
      INSERT INTO user_privacy (
        user_id,
        show_in_viewer_list,
        show_watch_history,
        show_following_list,
        allow_collab_requests,
        searchable_by_email,
        updated_at
      )
      VALUES (
        ${session.userId},
        ${updates.show_in_viewer_list ?? true},
        ${updates.show_watch_history ?? false},
        ${updates.show_following_list ?? true},
        ${updates.allow_collab_requests ?? true},
        ${updates.searchable_by_email ?? false},
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        show_in_viewer_list   = COALESCE(${updates.show_in_viewer_list ?? null}, user_privacy.show_in_viewer_list),
        show_watch_history    = COALESCE(${updates.show_watch_history ?? null}, user_privacy.show_watch_history),
        show_following_list   = COALESCE(${updates.show_following_list ?? null}, user_privacy.show_following_list),
        allow_collab_requests = COALESCE(${updates.allow_collab_requests ?? null}, user_privacy.allow_collab_requests),
        searchable_by_email   = COALESCE(${updates.searchable_by_email ?? null}, user_privacy.searchable_by_email),
        updated_at            = now()
      RETURNING *
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[privacy:PATCH] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
