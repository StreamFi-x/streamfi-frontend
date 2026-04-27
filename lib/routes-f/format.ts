import {
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type GroupBy = "day" | "week" | "month";

export function toFixedAmount(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function toFixedXlm(value: number): string {
  return value.toFixed(7).replace(/0+$/, "").replace(/\.$/, ".0");
}

export function clampNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

export function parseDateParam(value: string | null, label: string): Date {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO date`);
  }

  return parsed;
}

export function getPeriodKey(
  dateValue: string | Date,
  groupBy: GroupBy
): string {
  const date = typeof dateValue === "string" ? parseISO(dateValue) : dateValue;

  if (groupBy === "day") {
    return format(startOfDay(date), "yyyy-MM-dd");
  }

  if (groupBy === "week") {
    return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  }

  return format(startOfMonth(date), "yyyy-MM-dd");
}

export function getMonthRange(baseDate: Date): { from: Date; to: Date } {
  return {
    from: startOfMonth(baseDate),
    to: endOfMonth(baseDate),
  };
}

export function getInclusiveRange(
  from: Date,
  to: Date
): { from: Date; to: Date } {
  if (from > to) {
    throw new Error("from must be before or equal to to");
  }

  return { from: startOfDay(from), to: endOfDaySafe(to) };
}

export function endOfDaySafe(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setHours(23, 59, 59, 999);
  return nextDay;
}

export function getNextReminderTime(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - 15 * 60 * 1000);
}

export function getUpcomingWindowKey(dateValue: string | Date): string {
  const date = typeof dateValue === "string" ? parseISO(dateValue) : dateValue;
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function getRangeLabel(
  dateValue: string | Date,
  groupBy: GroupBy
): string {
  const date = typeof dateValue === "string" ? parseISO(dateValue) : dateValue;
  if (groupBy === "week") {
    return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  }
  if (groupBy === "month") {
    return format(startOfMonth(date), "yyyy-MM-01");
  }
  return format(startOfDay(date), "yyyy-MM-dd");
}

export function getWindowEnd(dateValue: string | Date, groupBy: GroupBy): Date {
  const date = typeof dateValue === "string" ? parseISO(dateValue) : dateValue;
  if (groupBy === "week") {
    return endOfWeek(date, { weekStartsOn: 1 });
  }
  if (groupBy === "month") {
    return endOfMonth(date);
  }
  return endOfDaySafe(date);
}
