import { NextRequest } from "next/server";
import { POST, GET } from "../route";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/clip-download-request", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/clip-download-request");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("POST /api/routes-f/clip-download-request", () => {
  it("queues a clip download request", async () => {
    const res = await POST(makePost({ clip_id: "clip-abc", requester_id: "user-1" }));
    const data = await res.json();

    expect(res.status).toBe(202);
    expect(data.status).toBe("queued");
    expect(typeof data.request_id).toBe("string");
    expect(data.request_id.length).toBeGreaterThan(0);
  });

  it("accepts optional format mp4", async () => {
    const res = await POST(makePost({ clip_id: "clip-abc", requester_id: "user-1", format: "mp4" }));
    expect(res.status).toBe(202);
  });

  it("accepts optional format gif", async () => {
    const res = await POST(makePost({ clip_id: "clip-gif", requester_id: "user-2", format: "gif" }));
    const data = await res.json();
    expect(res.status).toBe(202);
    expect(data.status).toBe("queued");
  });

  it("returns 400 when clip_id is missing", async () => {
    const res = await POST(makePost({ requester_id: "user-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when requester_id is missing", async () => {
    const res = await POST(makePost({ clip_id: "clip-abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid format", async () => {
    const res = await POST(makePost({ clip_id: "clip-abc", requester_id: "user-1", format: "avi" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/clip-download-request", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("each request gets a unique request_id", async () => {
    const res1 = await POST(makePost({ clip_id: "clip-x", requester_id: "user-x" }));
    const res2 = await POST(makePost({ clip_id: "clip-x", requester_id: "user-x" }));
    const data1 = await res1.json();
    const data2 = await res2.json();
    expect(data1.request_id).not.toBe(data2.request_id);
  });
});

describe("GET /api/routes-f/clip-download-request", () => {
  it("returns queued status immediately after POST", async () => {
    const postRes = await POST(makePost({ clip_id: "clip-lookup", requester_id: "user-3" }));
    const { request_id } = await postRes.json();

    const getRes = await GET(makeGet({ request_id }));
    const data = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(data.request_id).toBe(request_id);
    expect(data.status).toBe("queued");
    expect(data.download_url).toBeUndefined();
  });

  it("returns 400 when request_id is missing", async () => {
    const res = await GET(makeGet({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown request_id", async () => {
    const res = await GET(makeGet({ request_id: "req-does-not-exist" }));
    expect(res.status).toBe(404);
  });

  it("returns ready status and download_url after auto-complete delay", async () => {
    const postRes = await POST(makePost({ clip_id: "clip-delay", requester_id: "user-delay" }));
    const { request_id } = await postRes.json();

    await new Promise((r) => setTimeout(r, 5100));

    const getRes = await GET(makeGet({ request_id }));
    const data = await getRes.json();

    expect(data.status).toBe("ready");
    expect(typeof data.download_url).toBe("string");
    expect(data.download_url).toContain("clip-delay");
  }, 10000);

  it("response has request_id, status, and optional download_url fields only", async () => {
    const postRes = await POST(makePost({ clip_id: "clip-shape", requester_id: "user-shape" }));
    const { request_id } = await postRes.json();

    const getRes = await GET(makeGet({ request_id }));
    const data = await getRes.json();

    expect(data).toHaveProperty("request_id");
    expect(data).toHaveProperty("status");
    expect(["queued", "ready", "failed"]).toContain(data.status);
  });
});
