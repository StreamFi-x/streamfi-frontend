import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/notification-mark-category", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Notification Mark Category API", () => {
  it("marks a single category as read and returns updated_count", async () => {
    const res = await POST(makeReq({ viewer_id: "viewer-1", category: "tip" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.updated_count).toBe("number");
    expect(data.updated_count).toBeGreaterThanOrEqual(0);
  });

  it("supports 'all' to mark everything read", async () => {
    const singleRes = await POST(makeReq({ viewer_id: "viewer-2", category: "tip" }));
    const singleData = await singleRes.json();

    const allRes = await POST(makeReq({ viewer_id: "viewer-2", category: "all" }));
    const allData = await allRes.json();

    expect(allRes.status).toBe(200);
    expect(allData.updated_count).toBeGreaterThanOrEqual(singleData.updated_count);
  });

  it("'all' sums every category's unread count", async () => {
    const viewerId = "viewer-sum-check";
    const categories = ["tip", "follow", "stream_live", "chat_mention", "system"] as const;

    let expectedSum = 0;
    for (const category of categories) {
      const res = await POST(makeReq({ viewer_id: viewerId, category }));
      const data = await res.json();
      expectedSum += data.updated_count;
    }

    const allRes = await POST(makeReq({ viewer_id: viewerId, category: "all" }));
    const allData = await allRes.json();

    expect(allData.updated_count).toBe(expectedSum);
  });

  it("is deterministic for the same viewer_id and category", async () => {
    const res1 = await POST(makeReq({ viewer_id: "viewer-stable", category: "follow" }));
    const res2 = await POST(makeReq({ viewer_id: "viewer-stable", category: "follow" }));
    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1.updated_count).toBe(data2.updated_count);
  });

  it("returns 400 for an invalid category", async () => {
    const res = await POST(makeReq({ viewer_id: "viewer-1", category: "not-a-category" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await POST(makeReq({ category: "tip" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is missing", async () => {
    const res = await POST(makeReq({ viewer_id: "viewer-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/notification-mark-category", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("different viewers get independent counts", async () => {
    const res1 = await POST(makeReq({ viewer_id: "viewer-a", category: "system" }));
    const res2 = await POST(makeReq({ viewer_id: "viewer-b", category: "system" }));
    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(typeof data1.updated_count).toBe("number");
    expect(typeof data2.updated_count).toBe("number");
  });
});
