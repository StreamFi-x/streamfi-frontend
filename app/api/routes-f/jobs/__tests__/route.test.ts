jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(body), { ...init, headers });
    },
  },
}));

import { POST } from "../route";

const makeRequest = (body: object) =>
  new Request("http://localhost/api/routes-f/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/routes-f/jobs", () => {
  it("enqueues a job and returns queued status with job id", async () => {
    const response = await POST(
      makeRequest({
        type: "index_item",
        payload: { itemId: "item-1001" },
      })
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe("queued");
    expect(body.jobId).toMatch(/^job_\d+$/);
  });

  it("returns 400 for invalid job type", async () => {
    const response = await POST(
      makeRequest({
        type: "unknown_type",
        payload: { any: true },
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/invalid job type/i);
  });
});
