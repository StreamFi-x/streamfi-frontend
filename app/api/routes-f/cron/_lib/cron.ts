export interface CronSchedule {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  anyDayOfMonth: boolean;
  anyDayOfWeek: boolean;
}

const FIELD_DEFINITIONS = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "dayOfMonth", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "dayOfWeek", min: 0, max: 7 },
] as const;

function normalizeDayOfWeek(value: number): number {
  return value === 7 ? 0 : value;
}

function parseInteger(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid ${fieldName} token: ${value}`);
  }
  return parsed;
}

function parseField(value: string, min: number, max: number, fieldName: string): Set<number> {
  const tokens = value.split(",").map((token) => token.trim());
  if (tokens.length === 0) {
    throw new Error(`Empty ${fieldName} field`);
  }

  const values = new Set<number>();

  for (const token of tokens) {
    if (token === "") {
      throw new Error(`Invalid ${fieldName} token: ${token}`);
    }

    const [rangePart, stepPart] = token.split("/");
    const step = stepPart === undefined ? 1 : parseInteger(stepPart, fieldName);
    if (step < 1) {
      throw new Error(`Step must be at least 1 for ${fieldName}`);
    }

    let start: number;
    let end: number;

    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [startStr, endStr] = rangePart.split("-").map((piece) => piece.trim());
      if (startStr === "" || endStr === "") {
        throw new Error(`Invalid ${fieldName} range: ${rangePart}`);
      }
      start = parseInteger(startStr, fieldName);
      end = parseInteger(endStr, fieldName);
    } else {
      start = parseInteger(rangePart, fieldName);
      end = start;
    }

    if (fieldName === "dayOfWeek") {
      start = normalizeDayOfWeek(start);
      end = normalizeDayOfWeek(end);
    }

    if (fieldName === "dayOfWeek" && start === 0 && end === 7) {
      end = 0;
    }

    if (start < min || start > max || end < min || end > max) {
      throw new Error(`Invalid ${fieldName} range: ${rangePart}`);
    }

    if (end < start) {
      throw new Error(`Invalid ${fieldName} range: ${rangePart}`);
    }

    for (let current = start; current <= end; current += step) {
      values.add(fieldName === "dayOfWeek" ? normalizeDayOfWeek(current) : current);
    }
  }

  return values;
}

export function parseCronExpression(expression: string): CronSchedule {
  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Cron expression must contain exactly 5 fields");
  }

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;

  const minute = parseField(minuteExpr, 0, 59, "minute");
  const hour = parseField(hourExpr, 0, 23, "hour");
  const dayOfMonth = parseField(domExpr, 1, 31, "dayOfMonth");
  const month = parseField(monthExpr, 1, 12, "month");
  const dayOfWeek = parseField(dowExpr, 0, 7, "dayOfWeek");

  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
    anyDayOfMonth: domExpr === "*",
    anyDayOfWeek: dowExpr === "*",
  };
}

function formatNumberList(values: Set<number>, label: string): string {
  const sorted = Array.from(values).sort((a, b) => a - b);
  if (sorted.length === 1) {
    return `${label} ${sorted[0]}`;
  }
  return `${label}s ${sorted.join(", ")}`;
}

function formatTimeValue(value: number): string {
  return value.toString().padStart(2, "0");
}

function describeSchedule(schedule: CronSchedule): string {
  const minuteAny = schedule.minute.size === 60;
  const hourAny = schedule.hour.size === 24;
  const monthAny = schedule.month.size === 12;
  const domAny = schedule.anyDayOfMonth;
  const dowAny = schedule.anyDayOfWeek;

  if (minuteAny && hourAny && monthAny && domAny && dowAny) {
    return "Every minute";
  }

  if (minuteAny && hourAny && monthAny && domAny && !dowAny) {
    return `Every ${Array.from(schedule.dayOfWeek).map(describeWeekDay).join(", ")}`;
  }

  if (!minuteAny && hourAny && monthAny && domAny && dowAny) {
    return schedule.minute.size === 1
      ? `Every hour at minute ${Array.from(schedule.minute)[0]}`
      : `Every ${Array.from(schedule.minute).sort((a, b) => a - b).join(", ")} minutes of every hour`;
  }

  if (schedule.minute.size === 1 && schedule.hour.size === 1 && monthAny && domAny && dowAny) {
    return `Every day at ${formatTimeValue(Array.from(schedule.hour)[0])}:${formatTimeValue(Array.from(schedule.minute)[0])}`;
  }

  const parts: string[] = [];
  if (!minuteAny) {
    if (schedule.minute.size === 1) {
      parts.push(`minute ${Array.from(schedule.minute)[0]}`);
    } else {
      parts.push(formatNumberList(schedule.minute, "minute"));
    }
  }

  if (!hourAny) {
    parts.push(hourAny ? "every hour" : formatNumberList(schedule.hour, "hour"));
  }

  if (!domAny) {
    parts.push(formatNumberList(schedule.dayOfMonth, "day"));
  }

  if (!dowAny) {
    parts.push(`on ${Array.from(schedule.dayOfWeek).map(describeWeekDay).join(", ")}`);
  }

  if (!monthAny) {
    parts.push(`in ${Array.from(schedule.month).map(describeMonth).join(", ")}`);
  }

  return parts.length > 0 ? `Every ${parts.join(" ")}` : "Custom schedule";
}

function describeMonth(monthNumber: number): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[monthNumber - 1] ?? monthNumber.toString();
}

function describeWeekDay(value: number): string {
  const normalized = normalizeDayOfWeek(value);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[normalized];
}

function matchesSchedule(date: Date, schedule: CronSchedule): boolean {
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const dow = date.getUTCDay();

  if (!schedule.minute.has(minute) || !schedule.hour.has(hour) || !schedule.month.has(month)) {
    return false;
  }

  const dayOfMonthMatches = schedule.dayOfMonth.has(day);
  const dayOfWeekMatches = schedule.dayOfWeek.has(dow);

  if (schedule.anyDayOfMonth && schedule.anyDayOfWeek) {
    return true;
  }

  if (schedule.anyDayOfMonth) {
    return dayOfWeekMatches;
  }

  if (schedule.anyDayOfWeek) {
    return dayOfMonthMatches;
  }

  return dayOfMonthMatches || dayOfWeekMatches;
}

export function getNextCronRuns(schedule: CronSchedule, from: Date, count: number): string[] {
  const runs: string[] = [];
  const next = new Date(from.getTime());
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(next.getUTCMinutes() + 1);

  while (runs.length < count) {
    if (matchesSchedule(next, schedule)) {
      runs.push(next.toISOString());
    }
    next.setUTCMinutes(next.getUTCMinutes() + 1);
  }

  return runs;
}

export function formatCronDescription(schedule: CronSchedule): string {
  return describeSchedule(schedule);
}

export function parseDateFromIso(from?: string): Date {
  if (!from) {
    return new Date();
  }
  const parsed = new Date(from);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid 'from' timestamp");
  }
  return parsed;
}
