/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../chat-emote-mode/check/route";

function makeCheckReq(message: string) {
  return new NextRequest("http://localhost/api/routes-f/chat-emote-mode/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

describe("/api/routes-f/chat-emote-mode/check", () => {
  it("accepts all-emoji message", async () => {
    const req = makeCheckReq("😀 🎉 👍");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.is_emote_only).toBe(true);
    expect(data.would_be_blocked).toBe(false);
  });

  it("blocks plain text", async () => {
    const req = makeCheckReq("hello world");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.is_emote_only).toBe(false);
    expect(data.would_be_blocked).toBe(true);
  });

  it("blocks mixed emoji and text", async () => {
    const req = makeCheckReq("hello 😀 world");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.is_emote_only).toBe(false);
    expect(data.would_be_blocked).toBe(true);
  });

  it("accepts emoji with whitespace", async () => {
    const req = makeCheckReq("   😀   🎉   👍   ");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.is_emote_only).toBe(true);
    expect(data.would_be_blocked).toBe(false);
  });

  it("rejects empty message", async () => {
    const req = makeCheckReq("   ");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.is_emote_only).toBe(false);
  });

  it("rejects missing message field", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/chat-emote-mode/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("handles unicode emoji correctly", async () => {
    const req = makeCheckReq("❤️ 🚀 🌟");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.is_emote_only).toBe(true);
  });
});
