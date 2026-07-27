import { NextRequest } from "next/server";
import { POST } from "./route";

function makePost(subpath: "check" | "consume", body: unknown) {
  return new NextRequest(`http://localhost/api/routesF/notification-throttle/${subpath}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routesF/notification-throttle/check", () => {
  it("allows a notification when no prior record exists", async () => {
    const res = await POST(makePost("check", { viewer_id: "v-new-001", creator_id: "c-001" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.allowed).toBe(true);
  });

  it("blocks a notification within the throttle window after consume", async () => {
    const viewerId = `v-throttle-${Date.now()}`;
    const creatorId = "c-throttle";

    await POST(makePost("consume", { viewer_id: viewerId, creator_id: creatorId }));
    const checkRes = await POST(makePost("check", { viewer_id: viewerId, creator_id: creatorId }));
    const data = await checkRes.json();

    expect(data.allowed).toBe(false);
    expect(typeof data.next_allowed_at).toBe("string");
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await POST(makePost("check", { creator_id: "c-001" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await POST(makePost("check", { viewer_id: "v-001" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/routesF/notification-throttle/consume", () => {
  it("records a sent notification", async () => {
    const res = await POST(makePost("consume", { viewer_id: "v-consume-001", creator_id: "c-002" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.consumed).toBe(true);
    expect(typeof data.next_allowed_at).toBe("string");
  });
});
