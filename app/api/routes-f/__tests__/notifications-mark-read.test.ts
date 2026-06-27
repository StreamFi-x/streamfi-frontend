/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../notifications/mark-read/route";
import { resetStore, getStore } from "../notifications/mark-read/store";

function makeReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes-f/notifications/mark-read",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => resetStore());

describe("POST /api/routes-f/notifications/mark-read", () => {
  it("marks a single notification as read", async () => {
    const res = await POST(makeReq({ viewer_id: "viewer_001", ids: ["n_001"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated_count).toBe(1);
    const n = getStore().find((x) => x.id === "n_001");
    expect(n?.read).toBe(true);
  });

  it("marks multiple notifications as read", async () => {
    const res = await POST(
      makeReq({ viewer_id: "viewer_001", ids: ["n_001", "n_002", "n_004"] })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated_count).toBe(3);
  });

  it("does not double-count already-read notifications", async () => {
    const res = await POST(
      makeReq({ viewer_id: "viewer_001", ids: ["n_003"] })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated_count).toBe(0);
  });

  it("marks all notifications read with all=true", async () => {
    const res = await POST(makeReq({ viewer_id: "viewer_001", all: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updated_count).toBe(3);
    const remaining = getStore().filter(
      (n) => n.viewer_id === "viewer_001" && !n.read
    );
    expect(remaining).toHaveLength(0);
  });

  it("scopes all=true to the given viewer_id", async () => {
    await POST(makeReq({ viewer_id: "viewer_001", all: true }));
    const viewer2unread = getStore().filter(
      (n) => n.viewer_id === "viewer_002" && !n.read
    );
    expect(viewer2unread.length).toBeGreaterThan(0);
  });
});
