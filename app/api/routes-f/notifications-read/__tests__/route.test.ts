jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST, __resetNotificationsRead } from "../route";

const makeRequest = (body: unknown): import("next/server").NextRequest =>
  new Request("http://localhost/api/routes-f/notifications-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

beforeEach(() => {
  __resetNotificationsRead();
});

describe("POST /api/routes-f/notifications-read — validation", () => {
  it("returns 400 when viewer_id is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/routes-f/notifications-read — mark read", () => {
  it("marks a single notification read", async () => {
    const res = await POST(makeRequest({ viewer_id: "viewer_001", ids: ["n_001"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_count).toBe(1);
  });

  it("marks multiple notifications read", async () => {
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", ids: ["n_001", "n_002"] })
    );
    const body = await res.json();
    expect(body.updated_count).toBe(2);
  });

  it("marks all notifications read when all=true", async () => {
    const res = await POST(makeRequest({ viewer_id: "viewer_001", all: true }));
    const body = await res.json();
    expect(body.updated_count).toBe(3);
  });

  it("does not count already-read notifications", async () => {
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", ids: ["n_003"] })
    );
    const body = await res.json();
    expect(body.updated_count).toBe(0);
  });

  it("only marks notifications belonging to the given viewer_id", async () => {
    const res = await POST(makeRequest({ viewer_id: "viewer_002", all: true }));
    const body = await res.json();
    expect(body.updated_count).toBe(2);
  });
});