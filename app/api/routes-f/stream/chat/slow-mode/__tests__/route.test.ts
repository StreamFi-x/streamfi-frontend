/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, DELETE, GET } from "../route";

function makeReq(
  method: string,
  body?: unknown,
  url: string = "http://localhost/api/routes-f/stream/chat/slow-mode"
) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/routes-f/stream/chat/slow-mode", () => {
  it("enables slow mode with valid interval", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        interval_seconds: 5,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(5);
  });

  it("enables slow mode with minimum interval (2 seconds)", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream456",
        interval_seconds: 2,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(2);
  });

  it("enables slow mode with maximum interval (300 seconds)", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream789",
        interval_seconds: 300,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(300);
  });

  it("allows updating interval to a different value", async () => {
    const streamId = "stream-update";

    // First enable with 5 seconds
    await POST(
      makeReq("POST", {
        stream_id: streamId,
        interval_seconds: 5,
      })
    );

    // Update to 10 seconds
    const res = await POST(
      makeReq("POST", {
        stream_id: streamId,
        interval_seconds: 10,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.interval_seconds).toBe(10);
  });

  it("rejects interval below minimum (< 2)", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        interval_seconds: 1,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("at least 2");
  });

  it("rejects interval above maximum (> 300)", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        interval_seconds: 301,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("at most 300");
  });

  it("rejects non-integer interval", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        interval_seconds: 5.5,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("integer");
  });

  it("rejects NaN interval", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        interval_seconds: NaN,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric interval", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
        interval_seconds: "not-a-number",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing stream_id", async () => {
    const res = await POST(
      makeReq("POST", {
        interval_seconds: 5,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty stream_id", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "",
        interval_seconds: 5,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing interval_seconds", async () => {
    const res = await POST(
      makeReq("POST", {
        stream_id: "stream123",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream/chat/slow-mode",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "invalid json",
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/routes-f/stream/chat/slow-mode", () => {
  it("disables slow mode", async () => {
    // First enable
    await POST(
      makeReq("POST", {
        stream_id: "deletestream1",
        interval_seconds: 10,
      })
    );

    // Then delete
    const res = await DELETE(
      makeReq(
        "DELETE",
        undefined,
        "http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=deletestream1"
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
        "http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=neverenabled"
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

describe("GET /api/routes-f/stream/chat/slow-mode", () => {
  it("returns enabled state with interval when set", async () => {
    // First enable
    await POST(
      makeReq("POST", {
        stream_id: "getstream1",
        interval_seconds: 15,
      })
    );

    // Then get state
    const req = makeReq(
      "GET",
      undefined,
      "http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=getstream1"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(15);
  });

  it("returns disabled state for stream without slow mode", async () => {
    const req = makeReq(
      "GET",
      undefined,
      "http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=notconfigured"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(false);
    expect(body.interval_seconds).toBeUndefined();
  });

  it("returns 400 when stream_id is missing", async () => {
    const req = makeReq("GET", undefined);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("reflects changes after multiple POST calls", async () => {
    const streamId = "getstream3";

    // Enable with 5 seconds
    await POST(
      makeReq("POST", {
        stream_id: streamId,
        interval_seconds: 5,
      })
    );

    let req = makeReq(
      "GET",
      undefined,
      `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
    );
    let res = await GET(req);
    let body = await res.json();

    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(5);

    // Update to 20 seconds
    await POST(
      makeReq("POST", {
        stream_id: streamId,
        interval_seconds: 20,
      })
    );

    req = makeReq(
      "GET",
      undefined,
      `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
    );
    res = await GET(req);
    body = await res.json();

    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(20);

    // Disable
    await DELETE(
      makeReq(
        "DELETE",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
      )
    );

    req = makeReq(
      "GET",
      undefined,
      `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
    );
    res = await GET(req);
    body = await res.json();

    expect(body.enabled).toBe(false);
    expect(body.interval_seconds).toBeUndefined();
  });
});

describe("Integration: Full workflow", () => {
  it("completes full lifecycle: enable, verify, update, disable", async () => {
    const streamId = "lifecycle-stream";

    // 1. Enable slow mode with 10 second interval
    let res = await POST(
      makeReq("POST", {
        stream_id: streamId,
        interval_seconds: 10,
      })
    );
    let body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(10);

    // 2. Verify GET returns same state
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(10);

    // 3. Update to more restrictive interval (2 seconds)
    res = await POST(
      makeReq("POST", {
        stream_id: streamId,
        interval_seconds: 2,
      })
    );
    body = await res.json();
    expect(body.interval_seconds).toBe(2);

    // 4. Verify update is applied
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.interval_seconds).toBe(2);

    // 5. Update to more permissive interval (300 seconds)
    res = await POST(
      makeReq("POST", {
        stream_id: streamId,
        interval_seconds: 300,
      })
    );
    body = await res.json();
    expect(body.interval_seconds).toBe(300);

    // 6. Disable slow mode
    res = await DELETE(
      makeReq(
        "DELETE",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(false);

    // 7. Verify disabled
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${streamId}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(false);
  });

  it("handles multiple streams independently with different intervals", async () => {
    const stream1 = "multi-stream-1";
    const stream2 = "multi-stream-2";
    const stream3 = "multi-stream-3";

    // Setup stream 1: 5 second interval
    await POST(
      makeReq("POST", {
        stream_id: stream1,
        interval_seconds: 5,
      })
    );

    // Setup stream 2: 20 second interval
    await POST(
      makeReq("POST", {
        stream_id: stream2,
        interval_seconds: 20,
      })
    );

    // Stream 3: no slow mode

    // Verify stream 1
    let res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${stream1}`
      )
    );
    let body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(5);

    // Verify stream 2
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${stream2}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(20);

    // Verify stream 3 is disabled
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${stream3}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(false);

    // Disable stream 1
    await DELETE(
      makeReq(
        "DELETE",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${stream1}`
      )
    );

    // Verify stream 1 is disabled
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${stream1}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(false);

    // Verify stream 2 is still enabled with original interval
    res = await GET(
      makeReq(
        "GET",
        undefined,
        `http://localhost/api/routes-f/stream/chat/slow-mode?stream_id=${stream2}`
      )
    );
    body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.interval_seconds).toBe(20);
  });

  it("validates boundary intervals: 2 and 300", async () => {
    // Test minimum (2)
    let res = await POST(
      makeReq("POST", {
        stream_id: "boundary1",
        interval_seconds: 2,
      })
    );
    expect(res.status).toBe(200);

    // Test maximum (300)
    res = await POST(
      makeReq("POST", {
        stream_id: "boundary2",
        interval_seconds: 300,
      })
    );
    expect(res.status).toBe(200);

    // Test just below minimum (1)
    res = await POST(
      makeReq("POST", {
        stream_id: "boundary3",
        interval_seconds: 1,
      })
    );
    expect(res.status).toBe(400);

    // Test just above maximum (301)
    res = await POST(
      makeReq("POST", {
        stream_id: "boundary4",
        interval_seconds: 301,
      })
    );
    expect(res.status).toBe(400);
  });
});
