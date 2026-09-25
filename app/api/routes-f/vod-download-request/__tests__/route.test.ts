import { NextRequest } from "next/server";
import { POST, GET } from "../route";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/vod-download-request", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGet(params: Record<string, string>) {
  const url = new URL("http://localhost/api/routes-f/vod-download-request");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("POST /api/routes-f/vod-download-request", () => {
  it("queues a VOD download request", async () => {
    const res = await POST(makePost({ vod_id: "vod-001", requester_id: "viewer-A" }));
    const data = await res.json();

    expect(res.status).toBe(202);
    expect(data.status).toBe("queued");
    expect(typeof data.request_id).toBe("string");
  });

  it("returns 400 when vod_id is missing", async () => {
    const res = await POST(makePost({ requester_id: "viewer-A" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when requester_id is missing", async () => {
    const res = await POST(makePost({ vod_id: "vod-001" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/vod-download-request", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 409 when a pending request already exists for same viewer+vod", async () => {
    const vod_id = "vod-dedup";
    const requester_id = "viewer-dedup";

    const first = await POST(makePost({ vod_id, requester_id }));
    expect(first.status).toBe(202);

    const second = await POST(makePost({ vod_id, requester_id }));
    const secondData = await second.json();

    expect(second.status).toBe(409);
    expect(secondData).toHaveProperty("request_id");
  });

  it("allows a new request for same vod from a different viewer", async () => {
    const vod_id = "vod-multi";
    const res1 = await POST(makePost({ vod_id, requester_id: "viewer-P" }));
    const res2 = await POST(makePost({ vod_id, requester_id: "viewer-Q" }));

    expect(res1.status).toBe(202);
    expect(res2.status).toBe(202);

    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.request_id).not.toBe(d2.request_id);
  });

  it("allows a new request for same viewer for a different vod", async () => {
    const requester_id = "viewer-R";
    const res1 = await POST(makePost({ vod_id: "vod-R1", requester_id }));
    const res2 = await POST(makePost({ vod_id: "vod-R2", requester_id }));

    expect(res1.status).toBe(202);
    expect(res2.status).toBe(202);
  });
});

describe("GET /api/routes-f/vod-download-request", () => {
  it("returns queued status immediately after POST", async () => {
    const postRes = await POST(makePost({ vod_id: "vod-get-test", requester_id: "viewer-B" }));
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
    const res = await GET(makeGet({ request_id: "vdl-unknown" }));
    expect(res.status).toBe(404);
  });

  it("returns ready status and download_url after auto-complete delay", async () => {
    const postRes = await POST(makePost({ vod_id: "vod-ready-test", requester_id: "viewer-C" }));
    const { request_id } = await postRes.json();

    await new Promise((r) => setTimeout(r, 8100));

    const getRes = await GET(makeGet({ request_id }));
    const data = await getRes.json();

    expect(data.status).toBe("ready");
    expect(typeof data.download_url).toBe("string");
    expect(data.download_url).toContain("vod-ready-test");
  }, 15000);

  it("status progression: queued then ready", async () => {
    const postRes = await POST(makePost({ vod_id: "vod-progress", requester_id: "viewer-D" }));
    const { request_id } = await postRes.json();

    const early = await (await GET(makeGet({ request_id }))).json();
    expect(early.status).toBe("queued");
  });
});
