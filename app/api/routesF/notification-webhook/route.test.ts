import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "./route";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/notification-webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/notification-webhook");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function makeDelete(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routesF/notification-webhook");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, { method: "DELETE" });
}

describe("POST /api/routesF/notification-webhook", () => {
  it("creates a subscription and returns subscription_id and secret", async () => {
    const res = await POST(
      makePost({
        viewer_id: "viewer-wh-001",
        url: "https://example.com/hook",
        events: ["stream.live"],
      }),
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(typeof data.subscription_id).toBe("string");
    expect(typeof data.secret).toBe("string");
    expect(data.secret).toMatch(/^whsec_/);
  });

  it("returns 400 when url is not HTTPS", async () => {
    const res = await POST(
      makePost({ viewer_id: "v-001", url: "http://insecure.com/hook", events: ["follow"] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when events list is empty", async () => {
    const res = await POST(
      makePost({ viewer_id: "v-001", url: "https://example.com/hook", events: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when events contains only invalid values", async () => {
    const res = await POST(
      makePost({ viewer_id: "v-001", url: "https://example.com/hook", events: ["bad_event"] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await POST(makePost({ url: "https://example.com/hook", events: ["follow"] }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routesF/notification-webhook", () => {
  it("returns subscriptions for a viewer", async () => {
    const viewerId = `viewer-list-${Date.now()}`;
    await POST(makePost({ viewer_id: viewerId, url: "https://example.com/hook", events: ["follow"] }));

    const res = await GET(makeGet({ viewer_id: viewerId }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.subscriptions.length).toBeGreaterThan(0);
    expect(data.subscriptions[0]).toHaveProperty("subscription_id");
    expect(data.subscriptions[0]).not.toHaveProperty("secret");
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/routesF/notification-webhook", () => {
  it("deletes a subscription", async () => {
    const postRes = await POST(
      makePost({ viewer_id: "viewer-del-001", url: "https://example.com/hook", events: ["tip.received"] }),
    );
    const { subscription_id } = await postRes.json();

    const delRes = await DELETE(makeDelete({ subscription_id }));
    expect(delRes.status).toBe(204);
  });

  it("returns 404 for a non-existent subscription_id", async () => {
    const res = await DELETE(makeDelete({ subscription_id: "wh_does_not_exist" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when subscription_id is missing", async () => {
    const res = await DELETE(makeDelete({}));
    expect(res.status).toBe(400);
  });
});
