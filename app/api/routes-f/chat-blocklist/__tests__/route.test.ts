/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST, GET } from "../route";

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/routes-f/chat-blocklist", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/routes-f/chat-blocklist", () => {
  it("adds words to blocklist", async () => {
    const res = await POST(
      makeReq("POST", {
        creator_id: "creator123",
        add: ["spam", "scam"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.words).toContain("spam");
    expect(body.words).toContain("scam");
  });

  it("removes words from blocklist", async () => {
    // First add words
    await POST(
      makeReq("POST", {
        creator_id: "creator456",
        add: ["spam", "scam", "bot"],
      })
    );

    // Then remove one
    const res = await POST(
      makeReq("POST", {
        creator_id: "creator456",
        remove: ["spam"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.words).not.toContain("spam");
    expect(body.words).toContain("scam");
    expect(body.words).toContain("bot");
  });

  it("handles case-insensitive storage and dedup", async () => {
    await POST(
      makeReq("POST", {
        creator_id: "creator789",
        add: ["Spam", "SPAM", "spam", "Scam"],
      })
    );

    const res = await POST(
      makeReq("POST", {
        creator_id: "creator789",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.words).toHaveLength(2);
    expect(body.words).toContain("spam");
    expect(body.words).toContain("scam");
  });

  it("enforces cap at 200 entries", async () => {
    const wordsToAdd = Array.from({ length: 201 }, (_, i) => `word${i}`);
    const res = await POST(
      makeReq("POST", {
        creator_id: "creator999",
        add: wordsToAdd,
      })
    );

    expect(res.status).toBe(400);
  });

  it("allows adding up to 200 entries", async () => {
    const wordsToAdd = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const res = await POST(
      makeReq("POST", {
        creator_id: "creator200",
        add: wordsToAdd,
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.words).toHaveLength(200);
  });

  it("rejects missing creator_id", async () => {
    const res = await POST(
      makeReq("POST", {
        add: ["spam"],
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-array add parameter", async () => {
    const res = await POST(
      makeReq("POST", {
        creator_id: "creator123",
        add: "not-an-array",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-array remove parameter", async () => {
    const res = await POST(
      makeReq("POST", {
        creator_id: "creator123",
        remove: "not-an-array",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/chat-blocklist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/routes-f/chat-blocklist", () => {
  beforeEach(async () => {
    // Setup: add words to blocklist
    await POST(
      makeReq("POST", {
        creator_id: "getcreator",
        add: ["spam", "scam", "bot"],
      })
    );
  });

  it("returns blocklist for creator", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/chat-blocklist?creator_id=getcreator"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.words).toContain("spam");
    expect(body.words).toContain("scam");
    expect(body.words).toContain("bot");
  });

  it("returns empty array for creator with no blocklist", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/chat-blocklist?creator_id=noblocklist"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.words).toHaveLength(0);
  });

  it("returns 400 when creator_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/chat-blocklist");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
