/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/etag", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/etag", () => {
  it("generates a strong ETag by default", async () => {
    const res = await POST(makeReq({ content: "hello world" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    // SHA-256 of "hello world" is "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    // Truncated to 32 chars: "b94d27b9934d3e08a52e52d7da7dabfa"
    expect(body.etag).toBe('"b94d27b9934d3e08a52e52d7da7dabfa"');
    expect(body.matches).toBeUndefined();
  });

  it("generates a weak ETag when weak is true", async () => {
    const res = await POST(makeReq({ content: "hello world", weak: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.etag).toBe('W/"b94d27b9934d3e08a52e52d7da7dabfa"');
  });

  it("validates If-None-Match with exact match", async () => {
    const etag = '"b94d27b9934d3e08a52e52d7da7dabfa"';
    const res = await POST(
      makeReq({ content: "hello world", if_none_match: etag })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.etag).toBe(etag);
    expect(body.matches).toBe(true);
  });

  it("validates If-None-Match with wildcard *", async () => {
    const res = await POST(
      makeReq({ content: "hello world", if_none_match: "*" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.matches).toBe(true);
  });

  it("validates If-None-Match with weak comparison (weak vs strong)", async () => {
    const strongEtag = '"b94d27b9934d3e08a52e52d7da7dabfa"';
    const weakEtag = 'W/"b94d27b9934d3e08a52e52d7da7dabfa"';

    // Client sends weak, server generates strong
    let res = await POST(
      makeReq({ content: "hello world", if_none_match: weakEtag })
    );
    let body = await res.json();
    expect(res.status).toBe(200);
    expect(body.etag).toBe(strongEtag);
    expect(body.matches).toBe(true);

    // Client sends strong, server generates weak
    res = await POST(
      makeReq({ content: "hello world", weak: true, if_none_match: strongEtag })
    );
    body = await res.json();
    expect(res.status).toBe(200);
    expect(body.etag).toBe(weakEtag);
    expect(body.matches).toBe(true);
  });

  it("validates If-None-Match with comma-separated list of ETags", async () => {
    const list = '"other-tag", W/"b94d27b9934d3e08a52e52d7da7dabfa", "another"';
    const res = await POST(
      makeReq({ content: "hello world", if_none_match: list })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.matches).toBe(true);
  });

  it("returns matches: false for non-matching ETags", async () => {
    const res = await POST(
      makeReq({ content: "hello world", if_none_match: '"non-matching-tag"' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.matches).toBe(false);
  });

  it("rejects invalid input content", async () => {
    // Missing content
    let res = await POST(makeReq({}));
    expect(res.status).toBe(400);

    // Non-string content
    res = await POST(makeReq({ content: 12345 }));
    expect(res.status).toBe(400);
  });
});
