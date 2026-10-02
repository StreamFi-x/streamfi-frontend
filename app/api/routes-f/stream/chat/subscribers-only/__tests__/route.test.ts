/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, DELETE, GET } from "../route";

function makeReq(
  method: string,
  body?: unknown,
  url: string = "http://localhost/api/routes-f/stream/chat/subscribers-only"
) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/routes-f/stream/chat/subscribers-only", () => {
  it("enables subscribers-only restriction without tier", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBeUndefined();
  });

  it("enables subscribers-only restriction with tier restriction", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream456",
        tier_id: "gold",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBe("gold");
  });

  it("allows updating restriction with new tier", async () => {
    // First enable without tier
    await POST(
      makeReq("POST", {
        stream_id: "stream789",
      })
    );

    // Then enable with a tier
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream789",
        tier_id: "platinum",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBe("platinum");
  });

  it("allows updating tier restriction to a different tier", async () => {
    // First enable with a tier
    await POST(
      makeReq("POST", {
        stream_id: "stream999",
        tier_id: "silver",
      })
    );

    // Then update to different tier
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream999",
        tier_id: "gold",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tier_id).toBe("gold");
  });

  it("rejects missing stream_id", async () => {
    const res = await POST(
      makeReq("POST", {
        tier_id: "gold",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty stream_id", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "",
        tier_id: "gold",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty tier_id", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        tier_id: "",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects tier_id longer than 100 characters", async () => {
    const longTierId = "a".repeat(101);
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        tier_id: longTierId,
      })
    );
    expect(res.status).toBe(400);
  });

  it("allows tier_id of exactly 100 characters", async () => {
    const tierId = "a".repeat(100);
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        tier_id: tierId,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier_id).toBe(tierId);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream/chat/subscribers-only",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "invalid json",
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects non-string tier_id", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        tier_id: 123,
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/routes-f/stream/chat/subscribers-only", () => {
  it("disables subscribers-only restriction", async () => {
    // First enable
    await POST(
      makeReq("POST", {
        stream_id: "deletestream1",
        tier_id: "gold",
      })
    );

    // Then delete
    const res = await DELETE(
      makeReq(
        "DELETE",
        undefined,
        "http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=deletestream1"
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(false);
  });

  it("disables even if not previously enabled", async () => {
    const res = await DELETE(
      makeReq(
        "DELETE",
        undefined,
        "http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=neverenabled"
      )
    );

    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(false);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await DELETE(makeReq("DELETE", undefined));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/stream/chat/subscribers-only", () => {
  it("returns enabled state with tier_id when set without tier", async () => {
    // First enable without tier
    await POST(
      makeReq("POST", {
        stream_id: "getstream1",
      })
    );

    // Then get state
    const req = makeReq(
      "GET",
      undefined,
      "http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=getstream1"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBeUndefined();
  });

  it("returns enabled state with tier_id when set with tier", async () => {
    // First enable with tier
    await POST(
      makeReq("POST", {
        stream_id: "getstream2",
        tier_id: "platinum",
      })
    );

    // Then get state
    const req = makeReq(
      "GET",
      undefined,
      "http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=getstream2"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBe("platinum");
  });

  it("returns disabled state for stream without restriction", async () => {
    const req = makeReq(
      "GET",
      undefined,
      "http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=notconfigured"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(false);
    expect(body.tier_id).toBeUndefined();
  });

  it("returns 400 when stream_id is missing", async () => {
    const req = makeReq("GET", undefined);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("reflects changes after multiple POST calls", async () => {
    const streamId = "getstream3";

    // Enable without tier
    await POST(
      makeReq("POST", {
        stream_id: streamId,
      })
    );

    let req = makeReq(
      "GET",
      undefined,
      `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
    );
    let res = await GET(req);
    let body = await res.json();

    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBeUndefined();

    // Update with tier
    await POST(
      makeReq("POST", {
        stream_id: streamId,
        tier_id: "silver",
      })
    );

    req = makeReq(
      "GET",
      undefined,
      `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
    );
    res = await GET(req);
    body = await res.json();

    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBe("silver");

    // Disable
    await DELETE(
      makeReq(
        "DELETE",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
      )
    );

    req = makeReq(
      "GET",
      undefined,
      `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
    );
    res = await GET(req);
    body = await res.json();

    expect(body.enabled).toBe(false);
    expect(body.tier_id).toBeUndefined();
  });
});

describe("Integration: Full workflow", () => {
  it("completes full lifecycle: enable, verify, update, disable", async () => {
    const streamId = "lifecycle-stream";

    // 1. Enable subscribers-only without tier
    let res = await POST(
      makeReq("POST", {
        stream_id: streamId,
      })
    );
    let body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBeUndefined();

    // 2. Verify GET returns same state
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBeUndefined();

    // 3. Update to restrict to specific tier
    res = await POST(
      makeReq("POST", {
        stream_id: streamId,
        tier_id: "vip",
      })
    );
    body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBe("vip");

    // 4. Verify tier restriction is applied
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.tier_id).toBe("vip");

    // 5. Disable restriction
    res = await DELETE(
      makeReq(
        "DELETE",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(false);

    // 6. Verify disabled
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(false);
  });

  it("handles multiple streams independently", async () => {
    const stream1 = "multi-stream-1";
    const stream2 = "multi-stream-2";

    // Setup stream 1: no tier
    await POST(
      makeReq("POST", {
        stream_id: stream1,
      })
    );

    // Setup stream 2: with gold tier
    await POST(
      makeReq("POST", {
        stream_id: stream2,
        tier_id: "gold",
      })
    );

    // Verify stream 1
    let res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${stream1}`
      )
    );
    let body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBeUndefined();

    // Verify stream 2
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${stream2}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBe("gold");

    // Disable stream 1
    await DELETE(
      makeReq(
        "DELETE",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${stream1}`
      )
    );

    // Verify stream 1 is disabled
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${stream1}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(false);

    // Verify stream 2 is still enabled with tier
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/subscribers-only?stream_id=${stream2}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.tier_id).toBe("gold");
  });
});
