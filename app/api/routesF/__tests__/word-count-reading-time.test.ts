/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../word-count-reading-time/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/word-count-reading-time", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routesF/word-count-reading-time", () => {
  it("counts words, characters, sentences, and reading time with default WPM", async () => {
    const text = "Hello world. This is a test.";
    const res = await POST(makeReq({ text }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.words).toBe(6);
    expect(data.characters).toBe(28);
    expect(data.characters_no_spaces).toBe(23);
    expect(data.sentences).toBe(2);
    expect(data.reading_time_seconds).toBe(2);
  });

  it("uses custom WPM when provided", async () => {
    const text = "One two three four five six seven eight nine ten.";
    const res = await POST(makeReq({ text, wpm: 250 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.words).toBe(10);
    expect(data.reading_time_seconds).toBe(3);
  });

  it("rejects text larger than 1MB", async () => {
    const largeText = "a".repeat(1024 * 1024 + 1);
    const res = await POST(makeReq({ text: largeText }));
    expect(res.status).toBe(400);
  });

  it("rejects non-string text values", async () => {
    const res = await POST(makeReq({ text: 123 }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid wpm values", async () => {
    const res = await POST(makeReq({ text: "Hello world.", wpm: 0 }));
    expect(res.status).toBe(400);
  });
});
