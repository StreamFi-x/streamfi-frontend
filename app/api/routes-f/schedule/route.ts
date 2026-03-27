import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim().toLowerCase();

  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  try {
    const result = await sql`
      SELECT ss.id, ss.title, ss.description, ss.category, ss.scheduled_at,
             ss.duration_mins, ss.status, ss.created_at,
             COUNT(sr.viewer_id) AS reminder_count
      FROM stream_schedule ss
      INNER JOIN users u ON u.id = ss.creator_id
      LEFT JOIN stream_reminders sr ON sr.schedule_id = ss.id
      WHERE LOWER(u.username) = ${username}
        AND ss.status IN ('upcoming', 'live')
        AND ss.scheduled_at >= NOW()
      GROUP BY ss.id
      ORDER BY ss.scheduled_at ASC
      LIMIT 10
    `;

    let viewerId: string | null = null;
    const session = await verifySession(req);
    if (session.ok) {
      viewerId = session.userId;
    }

    const reminders = viewerId
      ? await sql`
          SELECT schedule_id FROM stream_reminders WHERE viewer_id = ${viewerId}
        `
      : { rows: [] as Array<{ schedule_id: string }> };

    const reminderIds = new Set(
      reminders.rows.map(row => String(row.schedule_id))
    );

    return NextResponse.json({
      schedule: result.rows.map(row => ({
        id: String(row.id),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        category: row.category ? String(row.category) : null,
        scheduled_at: new Date(String(row.scheduled_at)).toISOString(),
        duration_mins: Number.parseInt(String(row.duration_mins), 10),
        status: String(row.status),
        reminder_count: Number.parseInt(String(row.reminder_count), 10),
        viewer_has_reminder: reminderIds.has(String(row.id)),
      })),
    });
  } catch (error) {
    console.error("[routes-f schedule GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const description = body.description ? String(body.description) : null;
    const category = body.category ? String(body.category) : null;
    const durationMins = Number.parseInt(String(body.duration_mins ?? 120), 10);
    const scheduledAt = new Date(String(body.scheduled_at ?? ""));

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { error: "scheduled_at must be a valid ISO timestamp" },
        { status: 400 }
      );
    }

    const countResult = await sql`
      SELECT COUNT(*) AS count
      FROM stream_schedule
      WHERE creator_id = ${session.userId}
        AND status = 'upcoming'
        AND scheduled_at >= NOW()
    `;

    if (Number.parseInt(String(countResult.rows[0]?.count ?? 0), 10) >= 10) {
      return NextResponse.json(
        { error: "Creators can only have 10 upcoming events at a time" },
        { status: 400 }
      );
    }

    const insertResult = await sql`
      INSERT INTO stream_schedule (
        creator_id, title, description, category, scheduled_at, duration_mins, status
      )
      VALUES (
        ${session.userId},
        ${title},
        ${description},
        ${category},
        ${scheduledAt.toISOString()},
        ${durationMins},
        'upcoming'
      )
      RETURNING id, title, description, category, scheduled_at, duration_mins, status, created_at
    `;

    return NextResponse.json(
      { schedule: insertResult.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("[routes-f schedule POST]", error);
    return NextResponse.json(
      { error: "Failed to create scheduled stream" },
      { status: 500 }
    );
  }
}
