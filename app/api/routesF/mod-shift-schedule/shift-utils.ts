import { DAYS_OF_WEEK, DayOfWeek, ModShift } from './seed-data';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDay(day: unknown): day is DayOfWeek {
  return typeof day === 'string' && (DAYS_OF_WEEK as readonly string[]).includes(day);
}

export function isValidTime(time: unknown): time is string {
  return typeof time === 'string' && TIME_RE.test(time);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function crossesMidnight(shift: Pick<ModShift, 'start_time' | 'end_time'>): boolean {
  return toMinutes(shift.start_time) >= toMinutes(shift.end_time);
}

export function shiftsOverlap(a: Pick<ModShift, 'day' | 'start_time' | 'end_time'>, b: Pick<ModShift, 'day' | 'start_time' | 'end_time'>): boolean {
  const dayIndexA = DAYS_OF_WEEK.indexOf(a.day);
  const dayIndexB = DAYS_OF_WEEK.indexOf(b.day);
  const sameDay = dayIndexA === dayIndexB;
  const bIsNextDay = (dayIndexA + 1) % 7 === dayIndexB;
  const aIsNextDay = (dayIndexB + 1) % 7 === dayIndexA;

  if (!sameDay && !bIsNextDay && !aIsNextDay) {return false;}

  const aStart = toMinutes(a.start_time);
  const aEnd = crossesMidnight(a) ? toMinutes(a.end_time) + 1440 : toMinutes(a.end_time);
  let bStart = toMinutes(b.start_time);
  let bEnd = crossesMidnight(b) ? toMinutes(b.end_time) + 1440 : toMinutes(b.end_time);

  if (bIsNextDay) {
    bStart += 1440;
    bEnd += 1440;
  } else if (aIsNextDay) {
    bStart -= 1440;
    bEnd -= 1440;
  }

  return aStart < bEnd && bStart < aEnd;
}

export function isOnDutyAt(shift: ModShift, day: DayOfWeek, minutesOfDay: number): boolean {
  const start = toMinutes(shift.start_time);
  const end = toMinutes(shift.end_time);
  const wraps = start >= end;

  if (shift.day === day) {
    if (!wraps) {
      return minutesOfDay >= start && minutesOfDay < end;
    }
    return minutesOfDay >= start;
  }

  const dayIndex = DAYS_OF_WEEK.indexOf(day);
  const previousDay = DAYS_OF_WEEK[(dayIndex + 6) % 7];
  if (wraps && shift.day === previousDay) {
    return minutesOfDay < end;
  }

  return false;
}

export function dayAndMinutesFromDate(date: Date): { day: DayOfWeek; minutesOfDay: number } {
  return {
    day: DAYS_OF_WEEK[date.getUTCDay()],
    minutesOfDay: date.getUTCHours() * 60 + date.getUTCMinutes(),
  };
}
