import { holidays } from "./holidays";
import { WorkdaysResponse } from "../types";

export function calculateWorkdays(
  from: Date,
  to: Date,
  country?: string,
  customHolidays: string[] = [],
  weekendDays: number[] = [0, 6]
): WorkdaysResponse {
  let totalDays = 0;
  let holidaysInRange = 0;
  let weekendDaysUsed = 0;
  const allHolidays = new Set<string>();

  if (country && holidays[country]) {
    holidays[country].forEach(h => allHolidays.add(h));
  }

  customHolidays.forEach(h => allHolidays.add(h));

  const current = new Date(from);
  while (current <= to) {
    totalDays++;
    const dateStr = current.toISOString().split("T")[0];
    if (allHolidays.has(dateStr)) {
      holidaysInRange++;
    } else if (weekendDays.includes(current.getDay())) {
      weekendDaysUsed++;
    }
    current.setDate(current.getDate() + 1);
  }

  const workdays = totalDays - holidaysInRange - weekendDaysUsed;
  return {
    workdays,
    total_days: totalDays,
    holidays_in_range: holidaysInRange,
    weekend_days_used: weekendDaysUsed,
  };
}
