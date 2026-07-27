import { NextRequest } from "next/server";
import { GET, POST } from "./route";

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/priority-notification");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/priority-notification", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/routesF/priority-notification", () => {
  it("returns quota status for a creator", async () => {
    const res = await GET(makeGet({ creator_id: "creator-quota-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.quota).toBe(3);
    expect(typeof data.remaining_quota_this_week).toBe("number");
    expect(typeof data.used_this_week).toBe("number");
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/routesF/priority-notification", () => {
  it("sends a priority notification and decrements quota", async () => {
    const creatorId = `creator-prio-${Date.now()}`;
    const res = await POST(makePost({ creator_id: creatorId, message: "Big announcement!" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.notified_count).toBe("number");
    expect(data.notified_count).toBeGreaterThan(0);
    expect(data.remaining_quota_this_week).toBe(2);
  });

  it("enforces the 3-per-week quota", async () => {
    const creatorId = `creator-quota-${Date.now()}`;
    await POST(makePost({ creator_id: creatorId, message: "msg 1" }));
    await POST(makePost({ creator_id: creatorId, message: "msg 2" }));
    await POST(makePost({ creator_id: creatorId, message: "msg 3" }));
    const res = await POST(makePost({ creator_id: creatorId, message: "msg 4" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await POST(makePost({ message: "hi" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makePost({ creator_id: "c-001" }));
    expect(res.status).toBe(400);
  });
});
