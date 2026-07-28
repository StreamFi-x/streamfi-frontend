import { NextResponse } from 'next/server';
import { ModShift, seedShifts } from './seed-data';
import { dayAndMinutesFromDate, isOnDutyAt, isValidDay, isValidTime, shiftsOverlap } from './shift-utils';

const shifts: ModShift[] = [...seedShifts];
let nextShiftSeq = 1;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.creator_id !== 'string' || body.creator_id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid creator_id' }, { status: 400 });
    }

    if (typeof body.mod_id !== 'string' || body.mod_id.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid mod_id' }, { status: 400 });
    }

    if (!isValidDay(body.day)) {
      return NextResponse.json({ error: 'Invalid day' }, { status: 400 });
    }

    if (!isValidTime(body.start_time) || !isValidTime(body.end_time)) {
      return NextResponse.json({ error: 'start_time and end_time must be HH:MM' }, { status: 400 });
    }

    if (body.start_time === body.end_time) {
      return NextResponse.json({ error: 'start_time and end_time must differ' }, { status: 400 });
    }

    const candidate = {
      day: body.day,
      start_time: body.start_time,
      end_time: body.end_time,
    };

    const conflict = shifts.some(
      (existing) => existing.mod_id === body.mod_id && shiftsOverlap(existing, candidate)
    );

    if (conflict) {
      return NextResponse.json(
        { error: 'This shift overlaps with an existing shift for the same mod' },
        { status: 409 }
      );
    }

    const shift_id = `shift_${nextShiftSeq++}`;
    shifts.push({
      shift_id,
      creator_id: body.creator_id,
      mod_id: body.mod_id,
      day: body.day,
      start_time: body.start_time,
      end_time: body.end_time,
    });

    return NextResponse.json({ shift_id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creator_id');
    const at = searchParams.get('at');

    if (!creatorId || creatorId.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid creator_id parameter' }, { status: 400 });
    }

    let atDate = new Date();
    if (at) {
      const parsed = new Date(at);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid at parameter' }, { status: 400 });
      }
      atDate = parsed;
    }

    const { day, minutesOfDay } = dayAndMinutesFromDate(atDate);

    const onDutyMods = Array.from(
      new Set(
        shifts
          .filter((shift) => shift.creator_id === creatorId && isOnDutyAt(shift, day, minutesOfDay))
          .map((shift) => shift.mod_id)
      )
    );

    return NextResponse.json({ on_duty_mods: onDutyMods });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
