import { sql } from "@vercel/postgres";
import { writeNotification } from "@/lib/notifications";
import { getNextReminderTime } from "@/lib/routes-f/format";

export async function syncScheduleLiveStatusForCreator(
  creatorId: string
): Promise<void> {
  await sql`
    UPDATE stream_schedule
    SET status = 'live'
    WHERE id IN (
      SELECT id
      FROM stream_schedule
      WHERE creator_id = ${creatorId}
        AND status = 'upcoming'
        AND ABS(EXTRACT(EPOCH FROM (scheduled_at - NOW()))) <= 1800
      ORDER BY ABS(EXTRACT(EPOCH FROM (scheduled_at - NOW())))
      LIMIT 1
    )
  `;
}

export async function sendDueScheduleReminders(): Promise<number> {
  const result = await sql`
    SELECT sr.schedule_id, sr.viewer_id, ss.title, ss.scheduled_at, u.username AS creator_username
    FROM stream_reminders sr
    INNER JOIN stream_schedule ss ON ss.id = sr.schedule_id
    INNER JOIN users u ON u.id = ss.creator_id
    WHERE sr.sent = false
      AND sr.remind_at <= NOW()
      AND ss.status = 'upcoming'
  `;

  await Promise.all(
    result.rows.map(async row => {
      await writeNotification(
        String(row.viewer_id),
        "live",
        `Reminder: ${String(row.title)}`,
        `${String(row.creator_username)} goes live at ${new Date(String(row.scheduled_at)).toISOString()}`
      );

      await sql`
        UPDATE stream_reminders
        SET sent = true
        WHERE schedule_id = ${String(row.schedule_id)}::uuid
          AND viewer_id = ${String(row.viewer_id)}::uuid
      `;
    })
  );

  return result.rows.length;
}

export async function upsertReminder(scheduleId: string, viewerId: string) {
  const scheduleResult = await sql`
    SELECT id, scheduled_at, status
    FROM stream_schedule
    WHERE id = ${scheduleId}::uuid
    LIMIT 1
  `;

  if (scheduleResult.rows.length === 0) {
    throw new Error("Scheduled stream not found");
  }

  const schedule = scheduleResult.rows[0];
  if (String(schedule.status) === "cancelled") {
    throw new Error("Cannot set a reminder on a cancelled stream");
  }

  const remindAt = getNextReminderTime(new Date(String(schedule.scheduled_at)));

  const existing = await sql`
    SELECT sent
    FROM stream_reminders
    WHERE schedule_id = ${scheduleId}::uuid AND viewer_id = ${viewerId}
    LIMIT 1
  `;

  if (existing.rows.length > 0) {
    await sql`
      DELETE FROM stream_reminders
      WHERE schedule_id = ${scheduleId}::uuid AND viewer_id = ${viewerId}
    `;

    return { reminder_set: false };
  }

  await sql`
    INSERT INTO stream_reminders (schedule_id, viewer_id, remind_at)
    VALUES (${scheduleId}::uuid, ${viewerId}, ${remindAt.toISOString()})
    ON CONFLICT (schedule_id, viewer_id)
    DO UPDATE SET remind_at = EXCLUDED.remind_at, sent = false
  `;

  return { reminder_set: true, remind_at: remindAt.toISOString() };
}
