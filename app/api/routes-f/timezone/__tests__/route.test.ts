import { NextRequest } from "next/server";
import { GET } from "../route";
describe("GET /api/routes-f/timezone", () => {
  it("converts from UTC by default", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/timezone?timestamp=2026-01-15T12:00:00Z&to=America/New_York"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.converted.startsWith("2026-01-15T07:00:00")).toBe(true);
    expect(body.offset_hours).toBe(-5);
  });
  it("handles DST spring-forward correctly", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/timezone?timestamp=2026-03-08T07:30:00Z&to=America/New_York"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.converted.startsWith("2026-03-08T03:30:00")).toBe(true);
    expect(body.offset_hours).toBe(-4);
  });
  it("handles DST fall-back correctly", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/timezone?timestamp=2026-11-01T06:30:00Z&to=America/New_York"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.converted.startsWith("2026-11-01T01:30:00")).toBe(true);
    expect(body.offset_hours).toBe(-5);
  });
  it("rejects invalid timezone names", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/timezone?timestamp=2026-01-15T12:00:00Z&from=UTC&to=Mars/Olympus"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
