/**
 * @jest-environment node
 */
import { POST } from "../time-ago/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/time-ago", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const NOW = "2024-06-01T12:00:00Z";

describe("/api/routes-f/time-ago", () => {
  it("formats seconds ago", async () => {
    const ts = new Date(new Date(NOW).getTime() - 30 * 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_future).toBe(false);
    expect(data.seconds_diff).toBeLessThan(0);
    expect(typeof data.ago).toBe("string");
  });

  it("formats minutes ago", async () => {
    const ts = new Date(new Date(NOW).getTime() - 5 * 60 * 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW }));
    const data = await res.json();
    expect(data.ago).toContain("5");
    expect(data.is_future).toBe(false);
  });

  it("formats hours ago", async () => {
    const ts = new Date(new Date(NOW).getTime() - 3 * 3600 * 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW }));
    const data = await res.json();
    expect(data.ago).toContain("3");
    expect(data.is_future).toBe(false);
  });

  it("formats days ago", async () => {
    const ts = new Date(new Date(NOW).getTime() - 2 * 86400 * 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW }));
    const data = await res.json();
    expect(data.ago).toContain("2");
    expect(data.is_future).toBe(false);
  });

  it("formats future timestamps", async () => {
    const ts = new Date(new Date(NOW).getTime() + 3 * 3600 * 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW }));
    const data = await res.json();
    expect(data.is_future).toBe(true);
    expect(data.seconds_diff).toBeGreaterThan(0);
  });

  it("respects short style", async () => {
    const ts = new Date(new Date(NOW).getTime() - 5 * 60 * 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW, style: "short" }));
    const data = await res.json();
    expect(data.ago.length).toBeLessThan(15);
  });

  it("respects narrow style", async () => {
    const ts = new Date(new Date(NOW).getTime() - 5 * 60 * 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW, style: "narrow" }));
    expect((await res.json()).ago.length).toBeLessThan(10);
  });

  it("defaults now to current time", async () => {
    const ts = new Date(Date.now() - 10000).toISOString();
    const res = await POST(makeReq({ timestamp: ts }));
    expect(res.status).toBe(200);
  });

  it("rejects invalid timestamp", async () => {
    const res = await POST(makeReq({ timestamp: "not-a-date", now: NOW }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid style", async () => {
    const ts = new Date(new Date(NOW).getTime() - 1000).toISOString();
    const res = await POST(makeReq({ timestamp: ts, now: NOW, style: "fancy" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing timestamp", async () => {
    const res = await POST(makeReq({ now: NOW }));
    expect(res.status).toBe(400);
  });
});
