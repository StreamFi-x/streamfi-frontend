import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { writeNotification } from "@/lib/notifications";

type ModerationAction =
  | "warn"
  | "remove_content"
  | "suspend_user"
  | "ban_user"
  | "dismiss";

const VALID_ACTIONS: ModerationAction[] = [
  "warn",
  "remove_content",
  "suspend_user",
  "ban_user",
  "dismiss",
];

async function requireModOrAdmin(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }

  const { rows } = await sql`
    SELECT role FROM users WHERE id = ${session.userId} LIMIT 1
  `;
  const role = rows[0]?.role;
  if (role !== "admin" && role !== "moderator") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireModOrAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;

  let body: {
    action?: ModerationAction;
    notes?: string;
    duration_hours?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT * FROM moderation_queue WHERE id = ${id} LIMIT 1
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = rows[0];
  const reportedUserId: string | null = item.reported_user_id ?? null;

  if (action === "warn" && reportedUserId) {
    await writeNotification(
      reportedUserId,
      "live",
      "Moderation warning",
      "You have received a warning from StreamFi moderation."
    );
  }

  if (action === "remove_content") {
    if (item.item_type === "chat_message") {
      await sql`
        UPDATE chat_messages
        SET is_deleted = true,
            is_moderated = true,
            moderated_by = ${auth.session.userId}
        WHERE id = ${item.item_id}::int
      `;
    }

    if (item.item_type === "emote") {
      await sql`
        DELETE FROM channel_emotes WHERE id = ${item.item_id}
      `;
    }
  }

  if (action === "suspend_user" && reportedUserId) {
    const hours =
      typeof body.duration_hours === "number" && body.duration_hours > 0
        ? body.duration_hours
        : 24;
    await sql`
      UPDATE users
      SET suspended_until = now() + (${hours} * interval '1 hour')
      WHERE id = ${reportedUserId}
    `;
  }

  if (action === "ban_user" && reportedUserId) {
    await sql`
      UPDATE users
      SET is_banned = true,
          suspended_until = null
      WHERE id = ${reportedUserId}
    `;
  }

  await sql`
    UPDATE moderation_queue
    SET
      status = ${action === "dismiss" ? "dismissed" : "actioned"},
      assigned_to = ${auth.session.userId},
      action_taken = ${action},
      action_notes = ${body.notes ?? null},
      actioned_at = now()
    WHERE id = ${id}
  `;

  await sql`
    INSERT INTO moderation_audit_log (
      moderation_item_id,
      moderator_id,
      action,
      notes
    )
    VALUES (
      ${id},
      ${auth.session.userId},
      ${action},
      ${body.notes ?? null}
    )
  `;

  return NextResponse.json({ ok: true });
}
