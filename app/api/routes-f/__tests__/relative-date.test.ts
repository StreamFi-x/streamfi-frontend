/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../relative-date/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/relative-date", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/relative-date", () => {
  const mockNow = "2026-05-28T12:00:00.000Z";

  it("parses tomorrow relative to now", async () => {
    const res = await POST(makeReq({ text: "tomorrow", now: mockNow }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBe("2026-05-29T12:00:00.000Z");
    expect(data.matched).toBe("tomorrow");
  });

  it("parses yesterday relative to now", async () => {
    const res = await POST(makeReq({ text: "yesterday", now: mockNow }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBe("2026-05-27T12:00:00.000Z");
    expect(data.matched).toBe("yesterday");
  });

  it("parses next monday relative to now (which is a Thursday)", async () => {
    // 2026-05-28 is a Thursday.
    // Next Monday should be 2026-06-01.
    const res = await POST(makeReq({ text: "next monday", now: mockNow }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBe("2026-06-01T12:00:00.000Z");
    expect(data.matched).toBe("next monday");
  });

  it("parses in 3 days relative to now", async () => {
    const res = await POST(makeReq({ text: "in 3 days", now: mockNow }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBe("2026-05-31T12:00:00.000Z");
    expect(data.matched).toBe("in 3 days");
  });

  it("parses 2 weeks ago relative to now", async () => {
    const res = await POST(makeReq({ text: "2 weeks ago", now: mockNow }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBe("2026-05-14T12:00:00.000Z");
    expect(data.matched).toBe("2 weeks ago");
  });

  it("rejects unparseable input with 400", async () => {
    const res = await POST(makeReq({ text: "random string", now: mockNow }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unable to parse relative date");
  });

  it("rejects invalid now ISO string with 400", async () => {
    const res = await POST(makeReq({ text: "tomorrow", now: "invalid-date" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("now is not a valid date string");
  });

  it("rejects non-string text with 400", async () => {
    const res = await POST(makeReq({ text: 123 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("text must be a string");
  });

  it("uses the current system time if now is not provided", async () => {
    const res = await POST(makeReq({ text: "tomorrow" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBeDefined();
    expect(data.matched).toBe("tomorrow");

    // The resolved date should be roughly 24 hours from now
    const resolvedTime = new Date(data.resolved).getTime();
    const systemTomorrow = Date.now() + 24 * 60 * 60 * 1000;
    expect(Math.abs(resolvedTime - systemTomorrow)).toBeLessThan(10000); // 10s tolerance
  });
});
