/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../nanoid/route";
import { generateId } from "../nanoid/_lib/helpers";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/nanoid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("generateId", () => {
  it("returns a string of the requested size", () => {
    expect(generateId(21, "abc123").length).toBe(21);
    expect(generateId(10, "abc").length).toBe(10);
    expect(generateId(1, "ab").length).toBe(1);
  });

  it("only uses characters from the given alphabet", () => {
    const alphabet = "abc";
    const id = generateId(100, alphabet);
    for (const ch of id) {
      expect(alphabet).toContain(ch);
    }
  });

  it("generates unique IDs across many calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId(21, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")));
    expect(ids.size).toBe(1000);
  });
});

describe("POST /api/routes-f/nanoid", () => {
  it("returns 1 ID of length 21 with defaults", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(200);
    const { ids } = await res.json();
    expect(ids).toHaveLength(1);
    expect(ids[0]).toHaveLength(21);
  });

  it("respects custom count", async () => {
    const res = await POST(makeReq({ count: 5 }));
    expect(res.status).toBe(200);
    const { ids } = await res.json();
    expect(ids).toHaveLength(5);
  });

  it("respects custom size", async () => {
    const res = await POST(makeReq({ size: 10 }));
    expect(res.status).toBe(200);
    const { ids } = await res.json();
    expect(ids[0]).toHaveLength(10);
  });

  it("respects custom alphabet", async () => {
    const alphabet = "01";
    const res = await POST(makeReq({ size: 32, alphabet }));
    expect(res.status).toBe(200);
    const { ids } = await res.json();
    for (const ch of ids[0]) {
      expect(alphabet).toContain(ch);
    }
  });

  it("generates unique IDs across 100 requests", async () => {
    const res = await POST(makeReq({ count: 100 }));
    expect(res.status).toBe(200);
    const { ids } = await res.json();
    expect(new Set(ids).size).toBe(100);
  });

  it("returns 400 when count exceeds 100", async () => {
    const res = await POST(makeReq({ count: 101 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when count is not a positive integer", async () => {
    const res = await POST(makeReq({ count: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when size is not a positive integer", async () => {
    const res = await POST(makeReq({ size: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when alphabet has fewer than 2 characters", async () => {
    const res = await POST(makeReq({ alphabet: "a" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/nanoid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
