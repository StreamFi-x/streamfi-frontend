export type IntervalDelta = {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addCalendarYears(year: number, month: number, day: number, years: number) {
  const newYear = year + years;
  if (month === 1 && day === 29 && !isLeapYear(newYear)) {
    return { year: newYear, month, day: 28 };
  }
  return { year: newYear, month, day };
}

function addCalendarMonths(year: number, month: number, day: number, months: number) {
  const totalMonths = year * 12 + month + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12;
  const maxDay = daysInMonth(newYear, newMonth);
  const newDay = Math.min(day, maxDay);
  return { year: newYear, month: newMonth, day: newDay };
}

export function addIntervalsToDate(isoDate: string, delta: IntervalDelta): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const years = delta.years ?? 0;
  const months = delta.months ?? 0;
  const days = delta.days ?? 0;
  const hours = delta.hours ?? 0;
  const minutes = delta.minutes ?? 0;

  let year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  let day = date.getUTCDate();

  if (years !== 0) {
    ({ year, month, day } = addCalendarYears(year, month, day, years));
  }

  if (months !== 0) {
    ({ year, month, day } = addCalendarMonths(year, month, day, months));
  }

  const resultMs =
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    ) +
    days * 86_400_000 +
    hours * 3_600_000 +
    minutes * 60_000;

  return new Date(resultMs).toISOString();
}
