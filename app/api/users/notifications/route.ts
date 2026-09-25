import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { writeNotification } from "@/lib/notifications";
import {
  buildPage,
  keysetBounds,
  readPageParams,
  type KeysetRow,
} from "@/lib/pagination/cursor";

interface NotificationRow extends KeysetRow {
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: Date | string;
}

// ─── GET — caller's notifications, newest first ──────────────────────────────
// Shared cursor contract (docs/api/pagination.md):
//   ?limit&cursor → { items, nextCursor, hasMore, unreadCount }
// The user filter comes from the session, never from the cursor.
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const params = readPageParams(new URL(req.url).searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });
  if (!params.ok) {
    return params.response;
  }
  const { page } = params;
  const bound = keysetBounds(page.after);

  try {
    const [{ rows }, { rows: unread }] = await Promise.all([
      sql<NotificationRow>`
        SELECT
          id, type, title, body, is_read, created_at,
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts
        FROM notifications
        WHERE user_id = ${session.userId}
          AND (created_at, id) < (${bound.ts}::timestamptz, ${bound.id}::uuid)
        ORDER BY created_at DESC, id DESC
        LIMIT ${page.limit + 1}
      `,
      sql<{ count: string }>`
        SELECT count(*) AS count
        FROM notifications
        WHERE user_id = ${session.userId} AND is_read = false
      `,
    ]);

    return NextResponse.json(
      {
        ...buildPage(rows, page.limit, n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          text: n.body ?? "",
          read: n.is_read,
          created_at:
            n.created_at instanceof Date
              ? n.created_at.toISOString()
              : n.created_at,
        })),
        unreadCount: Number(unread[0]?.count ?? 0),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("GET notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// ─── POST — internal server-to-server write only ─────────────────────────────
export async function POST(req: NextRequest) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (
    !internalSecret ||
    req.headers.get("x-internal-secret") !== internalSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipientId, type, title, text } = await req.json();

  if (!recipientId || !type || !title || !text) {
    return NextResponse.json(
      { error: "Missing required fields: recipientId, type, title, text" },
      { status: 400 }
    );
  }

  try {
    await writeNotification(recipientId, type, title, text);
    return NextResponse.json({ message: "Notification added" });
  } catch (error) {
    console.error("POST notification error:", error);
    return NextResponse.json(
      { error: "Failed to add notification" },
      { status: 500 }
    );
  }
}

// ─── PATCH — mark all as read for caller ─────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await sql`
      UPDATE notifications
      SET is_read = true
      WHERE user_id = ${session.userId} AND is_read = false
    `;

    return NextResponse.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("PATCH notifications error:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
