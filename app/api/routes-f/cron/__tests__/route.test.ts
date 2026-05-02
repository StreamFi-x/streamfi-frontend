import { POST } from "../route";
import { NextRequest } from "next/server";

type CronResponse = { valid: boolean; description: string; next_runs: string[] };

function makePost(body: object): NextRequest {
  return new Request("http://localhost/api/routes-f/cron", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/routes-f/cron", () => {
  it("returns 5 upcoming run times for a simple schedule", async () => {
    const now = new Date(Date.UTC(2026, 0, 1, 8, 0, 0)).toISOString();
    const res = await POST(makePost({ expression: "0 9 * * *", count: 3, from: now }));
    expect(res.status).toBe(200);
    const data = await res.json() as CronResponse;
    expect(data.valid).toBe(true);
    expect(data.description).toContain("Every day at");
    expect(data.next_runs).toHaveLength(3);
    expect(data.next_runs[0]).toBe("2026-01-01T09:00:00.000Z");
    expect(data.next_runs[1]).toBe("2026-01-02T09:00:00.000Z");
  });

  it("supports step values and lists", async () => {
    const now = new Date(Date.UTC(2026, 0, 5, 9, 7, 0)).toISOString();
    const res = await POST(makePost({ expression: "*/15 9-10 * * 1-5", count: 4, from: now }));
    expect(res.status).toBe(200);
    const data = await res.json() as CronResponse;
    expect(data.next_runs).toEqual([
      "2026-01-05T09:15:00.000Z",
      "2026-01-05T09:30:00.000Z",
      "2026-01-05T09:45:00.000Z",
      "2026-01-05T10:00:00.000Z",
    ]);
  });

  it("rejects invalid cron expressions", async () => {
    const res = await POST(makePost({ expression: "* * *", count: 3 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/5 fields/);
  });

  it("rejects out-of-range values", async () => {
    const res = await POST(makePost({ expression: "61 0 * * *" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid minute range/);
  });

  it("defaults count to 5 and returns valid response", async () => {
    const now = new Date(Date.UTC(2026, 0, 1, 9, 0, 0)).toISOString();
    const res = await POST(makePost({ expression: "0 9 * * *", from: now }));
    expect(res.status).toBe(200);
    const data = await res.json() as CronResponse;
    expect(data.next_runs).toHaveLength(5);
  });
});
