/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../char-stats/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/char-stats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/char-stats", () => {
  it("counts ASCII text correctly", async () => {
    const res = await POST(makeReq({ text: "Hello, World! 123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(17);
    expect(data.letters).toBe(10);
    expect(data.digits).toBe(3);
    expect(data.punctuation).toBeGreaterThanOrEqual(1);
    expect(data.whitespace).toBe(2);
    expect(data.emoji).toBe(0);
    expect(data.by_script.latin).toBe(10);
  });

  it("counts mixed scripts", async () => {
    const res = await POST(makeReq({ text: "Hello Привет" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.by_script.latin).toBe(5);
    expect(data.by_script.cyrillic).toBe(6);
    expect(data.letters).toBe(11);
    expect(data.whitespace).toBe(1);
  });

  it("counts CJK characters", async () => {
    const res = await POST(makeReq({ text: "你好世界" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.letters).toBe(4);
    expect(data.by_script.cjk).toBe(4);
  });

  it("counts emoji", async () => {
    const res = await POST(makeReq({ text: "Hi 👋🏽 there 😊" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.emoji).toBeGreaterThanOrEqual(2);
  });

  it("handles ZWJ emoji sequences", async () => {
    // Family emoji: man+woman+girl+boy via ZWJ
    const family = "👨‍👩‍👧‍👦";
    const res = await POST(makeReq({ text: family }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.emoji).toBe(1);
  });

  it("handles empty string", async () => {
    const res = await POST(makeReq({ text: "" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(0);
    expect(data.letters).toBe(0);
    expect(data.emoji).toBe(0);
  });

  it("counts digits and symbols", async () => {
    const res = await POST(makeReq({ text: "42 + 58 = 100" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.digits).toBe(7);
    expect(data.whitespace).toBe(4);
  });

  it("rejects non-string text", async () => {
    const res = await POST(makeReq({ text: 42 }));
    expect(res.status).toBe(400);
  });

  it("rejects missing text field", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/char-stats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
