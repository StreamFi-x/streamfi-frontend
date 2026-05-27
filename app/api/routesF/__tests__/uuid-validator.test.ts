/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../uuid-validator/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/uuid-validator", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/uuid-validator", () => {
  it("validates a version 4 UUID", async () => {
    const res = await POST(makeReq({
      uuid: "550e8400-e29b-41d4-a716-446655440000"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(4);
    expect(data.variant).toBe("rfc4122");
    expect(data.normalized).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("validates a version 1 UUID", async () => {
    const res = await POST(makeReq({
      uuid: "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(1);
    expect(data.variant).toBe("rfc4122");
  });

  it("validates a version 3 UUID", async () => {
    const res = await POST(makeReq({
      uuid: "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(1);
    expect(data.variant).toBe("rfc4122");
  });

  it("validates a version 5 UUID", async () => {
    const res = await POST(makeReq({
      uuid: "6ba7b815-9dad-11d1-80b4-00c04fd430c8"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(5);
    expect(data.variant).toBe("rfc4122");
  });

  it("validates a version 7 UUID", async () => {
    const res = await POST(makeReq({
      uuid: "6ba7b817-9dad-11d1-80b4-00c04fd430c8"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(7);
    expect(data.variant).toBe("rfc4122");
  });

  it("handles nil UUID", async () => {
    const res = await POST(makeReq({
      uuid: "00000000-0000-0000-0000-000000000000"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(0);
    expect(data.variant).toBe("nil");
    expect(data.normalized).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("normalizes UUID without hyphens", async () => {
    const res = await POST(makeReq({
      uuid: "550e8400e29b41d4a716446655440000"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.normalized).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("normalizes uppercase UUID", async () => {
    const res = await POST(makeReq({
      uuid: "550E8400-E29B-41D4-A716-446655440000"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.normalized).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects malformed UUID - too short", async () => {
    const res = await POST(makeReq({
      uuid: "550e8400-e29b-41d4-a716-44665544000"
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it("rejects malformed UUID - invalid characters", async () => {
    const res = await POST(makeReq({
      uuid: "550e8400-e29b-41d4-a716-44665544000g"
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it("rejects malformed UUID - wrong format", async () => {
    const res = await POST(makeReq({
      uuid: "550e8400e29b41d4a716446655440000123"
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it("rejects unsupported version", async () => {
    const res = await POST(makeReq({
      uuid: "550e8400-e29b-21d4-a716-446655440000" // version 2
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.version).toBe(2);
  });

  it("handles missing uuid field", async () => {
    const res = await POST(makeReq({}));

    expect(res.status).toBe(400);
  });

  it("handles invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/uuid-validator", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("detects different variants", async () => {
    // Test NCS variant (first bit is 0)
    const res1 = await POST(makeReq({
      uuid: "550e8400-e29b-41d4-0716-446655440000"
    }));
    const data1 = await res1.json();
    expect(data1.variant).toBe("ncs");

    // Test RFC 4122 variant (first two bits are 10)
    const res2 = await POST(makeReq({
      uuid: "550e8400-e29b-41d4-8716-446655440000"
    }));
    const data2 = await res2.json();
    expect(data2.variant).toBe("rfc4122");
  });

  it("handles edge case UUIDs", async () => {
    // Test with all F's except version and variant bits
    const res = await POST(makeReq({
      uuid: "ffffffff-ffff-4fff-8fff-ffffffffffff"
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(4);
    expect(data.variant).toBe("rfc4122");
  });
});