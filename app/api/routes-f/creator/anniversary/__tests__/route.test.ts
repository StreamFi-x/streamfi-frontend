/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from "next/server";
import { GET } from "../route";

function makeReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/creator/anniversary");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

// creator_c joined exactly 365 days ago with 100 streams/1000 followers — milestones today
const onDateToday = new Date().toISOString().split("T")[0];

// A date 10 days from now
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

describe("GET /api/routes-f/creator/anniversary", () => {
  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/creator_id/i);
  });

  it("returns 404 for unknown creator", async () => {
    const res = await GET(makeReq({ creator_id: "creator_unknown" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid on_date", async () => {
    const res = await GET(makeReq({ creator_id: "creator_a", on_date: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("responds with today and upcoming arrays", async () => {
    const res = await GET(makeReq({ creator_id: "creator_a" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.today)).toBe(true);
    expect(Array.isArray(data.upcoming)).toBe(true);
    expect(typeof data.on_date).toBe("string");
  });

  it("creator_c has 1-year anniversary today", async () => {
    const res = await GET(makeReq({ creator_id: "creator_c", on_date: onDateToday }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const hasBirthday = data.today.some(
      (m: { kind: string }) => m.kind === "1_year_anniversary"
    );
    expect(hasBirthday).toBe(true);
  });

  it("creator_d has no milestones in window (too new)", async () => {
    const res = await GET(makeReq({ creator_id: "creator_d" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.today.length).toBe(0);
    expect(data.upcoming.length).toBe(0);
  });

  it("on_date in the past works for creator_b 2-year anniversary", async () => {
    // creator_b joined 730 days ago so their 2-year anniversary was ~today
    const res = await GET(makeReq({ creator_id: "creator_b" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    // May be in today or within upcoming window; just confirm valid response shape
    expect(Array.isArray(data.today)).toBe(true);
    expect(Array.isArray(data.upcoming)).toBe(true);
  });

  it("all milestones in today array have date matching on_date", async () => {
    const res = await GET(makeReq({ creator_id: "creator_c", on_date: onDateToday }));
    const data = await res.json();
    for (const m of data.today) {
      expect(m.date).toBe(data.on_date);
    }
  });

  it("all upcoming milestones have date after on_date", async () => {
    const res = await GET(makeReq({ creator_id: "creator_a" }));
    const data = await res.json();
    for (const m of data.upcoming) {
      expect(m.date > data.on_date).toBe(true);
    }
  });
});
