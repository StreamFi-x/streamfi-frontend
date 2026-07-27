import { ScheduledStream } from "./types";

const CRLF = "\r\n";

/**
 * Escape a value for an iCalendar TEXT property (RFC 5545 section 3.3.11).
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Format an ISO timestamp as a UTC iCalendar DATE-TIME: 20260101T120000Z.
 */
export function toIcsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Fold content lines longer than 75 octets (RFC 5545 section 3.1).
 */
export function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }

  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);

  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }

  if (rest.length > 0) {
    parts.push(` ${rest}`);
  }
  return parts.join(CRLF);
}

function endTime(stream: ScheduledStream): string {
  const end = new Date(
    new Date(stream.starts_at).getTime() + stream.duration_minutes * 60_000
  );
  return toIcsDate(end.toISOString());
}

export function buildVevent(
  stream: ScheduledStream,
  dtstamp: string
): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${stream.id}@streamfi`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsDate(stream.starts_at)}`,
    `DTEND:${endTime(stream)}`,
    `SUMMARY:${escapeIcsText(stream.title)}`,
    `DESCRIPTION:${escapeIcsText(stream.description)}`,
    `CATEGORIES:${escapeIcsText(stream.category)}`,
    `CLASS:${stream.privacy === "public" ? "PUBLIC" : "PRIVATE"}`,
    "END:VEVENT",
  ];
}

export function buildIcs(
  streams: ScheduledStream[],
  dtstamp: string = new Date().toISOString()
): string {
  const stamp = toIcsDate(dtstamp);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StreamFi//Stream Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...streams.flatMap(stream => buildVevent(stream, stamp)),
    "END:VCALENDAR",
  ];

  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
}
