/**
 * Tests for POST /api/routes-f/notifications/mark-read
 *
 * Verifies that:
 * 1. Mark by IDs works correctly
 * 2. Mark all works correctly
 * 3. Remaining unread_count is returned accurately
 * 4. Response includes updated_count
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST } from "../route";
import { resetStore } from "../store";

const makeRequest = (body: unknown): import("next/server").NextRequest =>
  new Request("http://localhost/api/routes-f/notifications/mark-read", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

beforeEach(() => {
  resetStore();
});

describe("POST /api/routes-f/notifications/mark-read — validation", () => {
  it("returns 400 when viewer_id is missing", async () => {
    const res = await POST(makeRequest({ ids: ["n_001"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 when neither ids nor all is provided", async () => {
    const res = await POST(makeRequest({ viewer_id: "viewer_001" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 when ids is empty array", async () => {
    const res = await POST(makeRequest({ viewer_id: "viewer_001", ids: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });
});

describe("POST /api/routes-f/notifications/mark-read — mark by IDs", () => {
  it("marks specific notifications as read", async () => {
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", ids: ["n_001", "n_002"] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_count).toBe(2);
    // viewer_001 has 3 unread originally, now 1 remains
    expect(body.unread_count).toBe(1);
  });

  it("returns 0 updated_count when IDs don't exist", async () => {
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", ids: ["nonexistent"] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_count).toBe(0);
    expect(body.unread_count).toBe(3); // unchanged
  });

  it("only marks unread notifications (idempotent)", async () => {
    // n_003 is already read
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", ids: ["n_001", "n_003"] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_count).toBe(1); // only n_001 was actually updated
    expect(body.unread_count).toBe(2); // 3 - 1 = 2
  });

  it("returns unread_count scoped to the viewer", async () => {
    const res = await POST(
      makeRequest({ viewer_id: "viewer_002", ids: ["n_101"] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_count).toBe(1);
    // viewer_002 has 2 unread originally, now 1 remains
    expect(body.unread_count).toBe(1);
  });
});

describe("POST /api/routes-f/notifications/mark-read — mark all", () => {
  it("marks all unread notifications as read", async () => {
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", all: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_count).toBe(3); // viewer_001 has 3 unread
    expect(body.unread_count).toBe(0);
  });

  it("marks all for different viewer independently", async () => {
    const res1 = await POST(
      makeRequest({ viewer_id: "viewer_001", all: true })
    );
    expect(res1.status).toBe(200);
    let body1 = await res1.json();
    expect(body1.updated_count).toBe(3);
    expect(body1.unread_count).toBe(0);

    // viewer_002 should still have 2 unread
    const res2 = await POST(
      makeRequest({ viewer_id: "viewer_002", ids: [] })
    );
    // This should fail validation, but let's test mark all for viewer_002
    const res3 = await POST(
      makeRequest({ viewer_id: "viewer_002", all: true })
    );
    expect(res3.status).toBe(200);
    const body3 = await res3.json();
    expect(body3.updated_count).toBe(2);
    expect(body3.unread_count).toBe(0);
  });

  it("returns 0 updated_count when all already read", async () => {
    // Mark all first
    await POST(makeRequest({ viewer_id: "viewer_001", all: true }));

    // Mark all again
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", all: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated_count).toBe(0); // nothing new to mark
    expect(body.unread_count).toBe(0);
  });
});

describe("POST /api/routes-f/notifications/mark-read — response shape", () => {
  it("response includes updated_count and unread_count", async () => {
    const res = await POST(
      makeRequest({ viewer_id: "viewer_001", ids: ["n_001"] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.updated_count).toBe("number");
    expect(typeof body.unread_count).toBe("number");
  });
});
