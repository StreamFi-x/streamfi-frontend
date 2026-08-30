/* eslint-disable @typescript-eslint/no-unused-vars */
export type DurationComponents = {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

const DURATION_PATTERN = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export function parseDuration(text: string): DurationComponents {
  if (typeof text !== "string") {
    throw new Error("Duration text must be a string.");
  }

  const match = DURATION_PATTERN.exec(text);
  if (!match) {
    throw new Error("Invalid ISO 8601 duration format.");
  }

  const [
    ,
    years = "0",
    months = "0",
    weeks = "0",
    days = "0",
    hours = "0",
    minutes = "0",
    seconds = "0",
  ] = match;

  return {
    years: Number(years),
    months: Number(months),
    weeks: Number(weeks),
    days: Number(days),
    hours: Number(hours),
    minutes: Number(minutes),
    seconds: Number(seconds),
  };
}

export function formatDuration(components: DurationComponents): string {
  const normalized = normalizeComponents(components);
  const { years, months, weeks, days, hours, minutes, seconds } = normalized;

  if (!years && !months && !weeks && !days && !hours && !minutes && !seconds) {
    return "PT0S";
  }

  let text = "P";

  if (years) {text += `${years}Y`;}
  if (months) {text += `${months}M`;}
  if (weeks) {text += `${weeks}W`;}
  if (days) {text += `${days}D`;}

  if (hours || minutes || seconds) {
    text += "T";
    if (hours) {text += `${hours}H`;}
    if (minutes) {text += `${minutes}M`;}
    if (seconds) {text += `${seconds}S`;}
  }

  return text;
}

export function durationToSeconds(components: DurationComponents): number {
  const { years, months, weeks, days, hours, minutes, seconds } = normalizeComponents(components);

  return (
    years * 31536000 +
    months * 2592000 +
    weeks * 604800 +
    days * 86400 +
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}

export function normalizeComponents(components: DurationComponents): Required<DurationComponents> {
  const normalized = {
    years: 0,
    months: 0,
    weeks: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    ...components,
  };

  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error("Duration components must be non-negative finite numbers.");
    }
  }

  return normalized;
}
