import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { target_time, now: nowParam, timezone = 'UTC' } = body;

    if (typeof target_time !== 'string' || !/^\d{2}:\d{2}$/.test(target_time)) {
      return NextResponse.json(
        { error: 'target_time must be in HH:MM format' },
        { status: 400 },
      );
    }

    const [hh, mm] = target_time.split(':').map(Number);
    if (hh > 23 || mm > 59) {
      return NextResponse.json({ error: 'target_time is not a valid clock time' }, { status: 400 });
    }

    // Resolve "now"
    const nowDate = nowParam ? new Date(nowParam) : new Date();
    if (isNaN(nowDate.getTime())) {
      return NextResponse.json({ error: 'now is not a valid ISO date string' }, { status: 400 });
    }

    // Build target datetime in the requested timezone using Intl
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });

    const parts = Object.fromEntries(
      fmt.formatToParts(nowDate).map(({ type, value }) => [type, value]),
    );

    // Construct today's target in the given timezone
    const todayTarget = new Date(
      `${parts.year}-${parts.month}-${parts.day}T${target_time.padStart(5, '0')}:00`,
    );

    // Convert the local timezone-aware date to UTC offset by computing the diff
    const localOffset = nowDate.getTime() - new Date(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`,
    ).getTime();

    let nextOccurrence = new Date(todayTarget.getTime() - localOffset);
    if (nextOccurrence <= nowDate) {
      nextOccurrence = new Date(nextOccurrence.getTime() + 24 * 60 * 60 * 1000);
    }

    const secondsUntil = Math.round((nextOccurrence.getTime() - nowDate.getTime()) / 1000);

    return NextResponse.json({
      seconds_until: secondsUntil,
      next_occurrence: nextOccurrence.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
