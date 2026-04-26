import { VOCABULARY } from "./vocabulary";
import type { WordEntry } from "./types";

const MIN_DATE = "1990-01-01";
const MAX_DATE = "2100-12-31";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcMidnightMs(dateIso: string): number {
  return Date.parse(`${dateIso}T00:00:00.000Z`);
}

export function getTodayUtcDateIso(): string {
  return toUtcDateString(new Date());
}

export function normalizeDateInput(
  rawDate: string | null
): { dateIso: string } | { error: string } {
  const dateIso = rawDate ?? getTodayUtcDateIso();

  if (!DATE_PATTERN.test(dateIso)) {
    return { error: "date must be in YYYY-MM-DD format." };
  }

  const parsed = new Date(`${dateIso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || toUtcDateString(parsed) !== dateIso) {
    return { error: "date is invalid." };
  }

  if (dateIso < MIN_DATE || dateIso > MAX_DATE) {
    return { error: `date must be between ${MIN_DATE} and ${MAX_DATE}.` };
  }

  return { dateIso };
}

export function selectWordForDate(
  dateIso: string,
  entries: WordEntry[] = VOCABULARY
): WordEntry {
  const epochDays = Math.floor(toUtcMidnightMs(dateIso) / 86_400_000);
  const index =
    ((epochDays % entries.length) + entries.length) % entries.length;
  return entries[index];
}
