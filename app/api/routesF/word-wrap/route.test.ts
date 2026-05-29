import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/word-wrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Word Wrap API", () => {
  it("wraps text at word boundaries", async () => {
    const res = await POST(makeReq({ text: "hello world foo bar", width: 11 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.wrapped).toBe("hello world\nfoo bar");
    expect(data.line_count).toBe(2);
  });

  it("preserves existing newlines as paragraph breaks", async () => {
    const res = await POST(makeReq({ text: "first line\nsecond line", width: 100 }));
    const data = await res.json();
    expect(data.line_count).toBe(2);
    expect(data.wrapped).toBe("first line\nsecond line");
  });

  it("hard breaks long words", async () => {
    const res = await POST(makeReq({ text: "abcdefghijklmnop", width: 5, hard_break: true }));
    const data = await res.json();
    expect(data.wrapped).toBe("abcde\nfghij\nklmno\np");
    expect(data.line_count).toBe(4);
  });

  it("returns 400 for missing text", async () => {
    const res = await POST(makeReq({ width: 10 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid width", async () => {
    const res = await POST(makeReq({ text: "hello", width: 0 }));
    expect(res.status).toBe(400);
  });

  it("handles empty text", async () => {
    const res = await POST(makeReq({ text: "", width: 10 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.line_count).toBe(1);
  });
});
