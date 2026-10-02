import { NextRequest } from "next/server";
import { POST } from "../route";

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/clip-auto-tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/clip-auto-tags", () => {
  it("returns gaming tags for a gaming title", async () => {
    const res = await POST(
      makePostReq({ title: "Epic Valorant Ranked Grind" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags).toContain("gaming");
  });

  it("returns music tags for a music title", async () => {
    const res = await POST(
      makePostReq({ title: "Live DJ Set - Techno Beats" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags).toContain("music");
  });

  it("returns irl tags for an IRL title", async () => {
    const res = await POST(
      makePostReq({ title: "Daily Vlog - Travel Food Adventure" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags).toContain("irl");
  });

  it("returns crypto tags when description contains crypto keywords", async () => {
    const res = await POST(
      makePostReq({
        title: "Stream Updates",
        description: "Discussing Bitcoin, Ethereum and Stellar XLM staking",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toContain("crypto");
  });

  it("returns at most 5 tags", async () => {
    const res = await POST(
      makePostReq({
        title: "gaming music art tech chat crypto",
        description: "irl sports competitive coding painting beats",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags.length).toBeLessThanOrEqual(5);
  });

  it("returns empty tags array for unrecognized title", async () => {
    const res = await POST(makePostReq({ title: "xyzzy flurble" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toEqual([]);
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makePostReq({ description: "something" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty string", async () => {
    const res = await POST(makePostReq({ title: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when description is not a string", async () => {
    const res = await POST(makePostReq({ title: "test", description: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/routes-f/clip-auto-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });
});
