import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { writeNotification } from "@/lib/notifications";

// ─── GET — fetch caller's notifications ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    const { rows } = await sql`
      SELECT COALESCE(notifications, ARRAY[]::jsonb[]) AS notifications
      FROM users
      WHERE id = ${session.userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // notifications is JSONB[] — already parsed by @vercel/postgres into an array
    const raw: Record<string, unknown>[] = rows[0].notifications ?? [];

    // Newest-first, cap at 50
    const notifications = [...raw].reverse().slice(0, 50);
    const unreadCount = notifications.filter(n => n.read === false).length;

    return NextResponse.json({ notifications, unreadCount });
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
  if (!session.ok) {return session.response;}

  try {
    await sql`
      UPDATE users
      SET notifications = ARRAY(
        SELECT jsonb_set(n::jsonb, '{read}', 'true'::jsonb)
        FROM unnest(COALESCE(notifications, ARRAY[]::jsonb[])) AS t(n)
      )
      WHERE id = ${session.userId}
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
