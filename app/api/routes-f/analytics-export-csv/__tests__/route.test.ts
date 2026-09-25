/**
 * @jest-environment node
 *
 * Tests for GET /api/routes-f/analytics-export-csv
 *
 * Seed summary:
 *   revenue:channel_a — 3 days (42.5, 18, 93.25)
 *   viewers:channel_a — 3 days (120, 95, 210)
 *   revenue:channel_b — 1 day (0)
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { getMetricSeries } from "../seed";
import { seriesToCsv } from "../format-csv";

function makeReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/analytics-export-csv${query}`);
}

describe("seriesToCsv", () => {
  it("writes a header row followed by one row per point", () => {
    const series = getMetricSeries("revenue", "channel_a")!;
    const csv = seriesToCsv(series);

    expect(csv).toBe(
      "date,value\r\n2026-06-18,42.5\r\n2026-06-19,18\r\n2026-06-20,93.25\r\n",
    );
  });

  it("produces just a header row for an empty series", () => {
    const csv = seriesToCsv({ metric: "revenue", channel_id: "empty", points: [] });
    expect(csv).toBe("date,value\r\n");
  });

  it("quotes and escapes a field containing a comma or quote", () => {
    const csv = seriesToCsv({
      metric: "revenue",
      channel_id: "x",
      points: [{ date: '2026-06-18,"weird"', value: 1 }],
    });
    expect(csv).toContain('"2026-06-18,""weird"""');
  });
});

describe("GET /api/routes-f/analytics-export-csv", () => {
  it("requires metric", async () => {
    const res = await GET(makeReq("?channel_id=channel_a"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("metric");
  });

  it("rejects an invalid metric", async () => {
    const res = await GET(makeReq("?metric=bogus&channel_id=channel_a"));
    expect(res.status).toBe(400);
  });

  it("requires channel_id", async () => {
    const res = await GET(makeReq("?metric=revenue"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("channel_id");
  });

  it("rejects a non-positive-integer days value", async () => {
    const res = await GET(makeReq("?metric=revenue&channel_id=channel_a&days=0"));
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric days value", async () => {
    const res = await GET(makeReq("?metric=revenue&channel_id=channel_a&days=abc"));
    expect(res.status).toBe(400);
  });

  it("404s for a channel with no data for the given metric", async () => {
    const res = await GET(makeReq("?metric=revenue&channel_id=nope"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("nope");
  });

  it("returns the full series as CSV with the expected headers", async () => {
    const res = await GET(makeReq("?metric=revenue&channel_id=channel_a"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="revenue-channel_a.csv"',
    );

    const text = await res.text();
    expect(text).toBe(
      "date,value\r\n2026-06-18,42.5\r\n2026-06-19,18\r\n2026-06-20,93.25\r\n",
    );
  });

  it("restricts to the most recent N days when days is given", async () => {
    const res = await GET(
      makeReq("?metric=revenue&channel_id=channel_a&days=1"),
    );
    const text = await res.text();
    expect(text).toBe("date,value\r\n2026-06-20,93.25\r\n");
  });

  it("returns the viewers series for the same channel independently of revenue", async () => {
    const res = await GET(makeReq("?metric=viewers&channel_id=channel_a"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("2026-06-20,210");
  });

  it("handles a single-row series", async () => {
    const res = await GET(makeReq("?metric=revenue&channel_id=channel_b"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("date,value\r\n2026-06-20,0\r\n");
  });
});
