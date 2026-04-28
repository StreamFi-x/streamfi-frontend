import { POST } from "../route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/time-ago";

const NOW_MS = 1_700_000_000_000; // fixed reference point

function req(body: object) {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /time-ago", () => {
  it("formats seconds ago", async () => {
    const ts = NOW_MS - 30 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_future).toBe(false);
    expect(body.seconds_diff).toBe(-30);
    expect(body.ago).toContain("second");
  });

  it("formats minutes ago", async () => {
    const ts = NOW_MS - 5 * 60 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { ago, seconds_diff, is_future } = await res.json();
    expect(is_future).toBe(false);
    expect(seconds_diff).toBe(-300);
    expect(ago).toContain("minute");
  });

  it("formats hours ago", async () => {
    const ts = NOW_MS - 3 * 3600 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { ago } = await res.json();
    expect(ago).toContain("hour");
  });

  it("formats days ago", async () => {
    const ts = NOW_MS - 2 * 86400 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { ago } = await res.json();
    expect(ago).toContain("day");
  });

  it("formats weeks ago", async () => {
    const ts = NOW_MS - 2 * 7 * 86400 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { ago } = await res.json();
    expect(ago).toContain("week");
  });

  it("formats months ago", async () => {
    const ts = NOW_MS - 45 * 86400 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { ago } = await res.json();
    expect(ago).toContain("month");
  });

  it("formats years ago", async () => {
    const ts = NOW_MS - 400 * 86400 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { ago } = await res.json();
    expect(ago).toContain("year");
  });

  it("handles future timestamp", async () => {
    const ts = NOW_MS + 3600 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { ago, is_future } = await res.json();
    expect(is_future).toBe(true);
    expect(ago).toContain("hour");
  });

  it("style short produces shorter output", async () => {
    const ts = NOW_MS - 3 * 3600 * 1000;
    const longRes = await POST(req({ timestamp: ts, now: NOW_MS, style: "long" }));
    const shortRes = await POST(req({ timestamp: ts, now: NOW_MS, style: "short" }));
    const longBody = await longRes.json();
    const shortBody = await shortRes.json();
    expect(shortBody.ago.length).toBeLessThanOrEqual(longBody.ago.length);
  });

  it("style narrow produces output", async () => {
    const ts = NOW_MS - 3 * 3600 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS, style: "narrow" }));
    expect(res.status).toBe(200);
    const { ago } = await res.json();
    expect(ago.length).toBeGreaterThan(0);
  });

  it("accepts ISO string timestamp", async () => {
    const res = await POST(req({ timestamp: "2020-01-01T00:00:00Z", now: "2021-01-01T00:00:00Z" }));
    expect(res.status).toBe(200);
    const { ago } = await res.json();
    expect(ago).toContain("year");
  });

  it("returns 400 for missing timestamp", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid style", async () => {
    const res = await POST(req({ timestamp: NOW_MS, style: "ultra" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const r = new NextRequest(BASE, { method: "POST", body: "not-json" });
    const res = await POST(r);
    expect(res.status).toBe(400);
  });

  it("seconds_diff is positive for future", async () => {
    const ts = NOW_MS + 60 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { seconds_diff } = await res.json();
    expect(seconds_diff).toBeGreaterThan(0);
  });

  it("seconds_diff is negative for past", async () => {
    const ts = NOW_MS - 60 * 1000;
    const res = await POST(req({ timestamp: ts, now: NOW_MS }));
    const { seconds_diff } = await res.json();
    expect(seconds_diff).toBeLessThan(0);
  });
});
