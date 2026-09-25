import { GET } from "./route";
import { buildIcs, escapeIcsText, foldLine, toIcsDate } from "./ics";
import { scheduleForCreator } from "./seed-data";

const URL_BASE = "http://localhost/api/routesF/stream-schedule";

function getRequest(query: string) {
  return new Request(`${URL_BASE}${query}`, { method: "GET" });
}

describe("/api/routesF/stream-schedule", () => {
  it("returns text/calendar by default", async () => {
    const response = await GET(getRequest("?creator_id=creator_123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8"
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      "creator_123-schedule.ics"
    );
  });

  it("returns text/calendar for format=ics", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_123&format=ics")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8"
    );
  });

  it("emits the required calendar header and footer lines", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_123&format=ics")
    );
    const body = await response.text();
    const lines = body.split("\r\n");

    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("PRODID:-//StreamFi//Stream Schedule//EN");
    expect(lines).toContain("CALSCALE:GREGORIAN");
    expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("emits one VEVENT per scheduled stream", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_123&format=ics")
    );
    const body = await response.text();

    const expected = scheduleForCreator("creator_123").length;
    expect(expected).toBe(3);
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(expected);
    expect(body.match(/END:VEVENT/g)).toHaveLength(expected);
  });

  it("includes SUMMARY, DTSTART and DTEND for each event", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_123&format=ics")
    );
    const body = await response.text();

    expect(body).toContain("SUMMARY:Soroban Contract Deep Dive");
    expect(body).toContain("DTSTART:20260105T180000Z");
    expect(body).toContain("DTEND:20260105T200000Z");
  });

  it("escapes reserved characters in text properties", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_123&format=ics")
    );
    const body = await response.text();

    expect(body).toContain("SUMMARY:Subscriber Q&A\\; behind the setup");
  });

  it("uses a different event count for a different creator", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_456&format=ics")
    );
    const body = await response.text();

    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("returns JSON for format=json", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_123&format=json")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(data.creator_id).toBe("creator_123");
    expect(data.streams).toHaveLength(3);
  });

  it("returns 400 when creator_id is missing", async () => {
    const response = await GET(getRequest("?format=ics"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("creator_id");
  });

  it("returns 400 for an unsupported format", async () => {
    const response = await GET(
      getRequest("?creator_id=creator_123&format=pdf")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("pdf");
  });

  it("returns 404 for a creator with no scheduled streams", async () => {
    const response = await GET(getRequest("?creator_id=creator_nobody"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("creator_nobody");
  });
});

describe("ics helpers", () => {
  it("formats ISO timestamps as UTC iCalendar date-times", () => {
    expect(toIcsDate("2026-01-01T12:00:00.000Z")).toBe("20260101T120000Z");
  });

  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("leaves short lines unfolded", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds long lines with a leading space on continuations", () => {
    const folded = foldLine(`SUMMARY:${"x".repeat(200)}`);
    const parts = folded.split("\r\n");

    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toHaveLength(75);
    parts.slice(1).forEach(part => expect(part.startsWith(" ")).toBe(true));
  });

  it("builds an empty calendar with no events", () => {
    const ics = buildIcs([], "2026-01-01T00:00:00.000Z");

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("uses CRLF line endings and a trailing CRLF", () => {
    const ics = buildIcs(
      scheduleForCreator("creator_456"),
      "2026-01-01T00:00:00.000Z"
    );

    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.includes("\n\n")).toBe(false);
  });
});
