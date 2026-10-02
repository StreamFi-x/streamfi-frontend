import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/routes-f/metrics-prometheus", () => {
  it("returns prometheus format metrics with 200 status", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/routes-f/metrics-prometheus"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");

    const text = await res.text();
    expect(text).toContain("http_request_duration_seconds");
    expect(text).toContain("http_requests_total");
    expect(text).toContain("http_error_rate");
    expect(text).toContain("active_streams");
  });

  it("handles custom active_streams query parameter", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/routes-f/metrics-prometheus?active_streams=15"
    );
    const res = await GET(req);

    const text = await res.text();
    expect(text).toContain("active_streams 15");
  });
});
