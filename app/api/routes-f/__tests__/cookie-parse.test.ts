/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../cookie-parse/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/cookie-parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/cookie-parse", () => {
  describe("parse mode", () => {
    it("parses a simple cookie", async () => {
      const res = await POST(makeReq({ mode: "parse", input: "session=abc123" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session.value).toBe("abc123");
      expect(data.session.secure).toBe(false);
      expect(data.session.http_only).toBe(false);
    });

    it("parses a cookie with all attributes", async () => {
      const input =
        "token=xyz; Expires=Wed, 01 Jan 2025 00:00:00 GMT; Max-Age=3600; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Strict";
      const res = await POST(makeReq({ mode: "parse", input }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token.value).toBe("xyz");
      expect(data.token.expires).toBe("Wed, 01 Jan 2025 00:00:00 GMT");
      expect(data.token.max_age).toBe(3600);
      expect(data.token.domain).toBe("example.com");
      expect(data.token.path).toBe("/");
      expect(data.token.secure).toBe(true);
      expect(data.token.http_only).toBe(true);
      expect(data.token.same_site).toBe("Strict");
    });

    it("handles URL-encoded values", async () => {
      const res = await POST(makeReq({ mode: "parse", input: "user=hello%20world" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.value).toBe("hello world");
    });

    it("rejects invalid SameSite value", async () => {
      const res = await POST(
        makeReq({ mode: "parse", input: "x=1; SameSite=Invalid" })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("build mode", () => {
    it("builds a simple Set-Cookie header", async () => {
      const res = await POST(
        makeReq({ mode: "build", input: { name: "session", value: "abc" } })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.header).toBe("session=abc");
    });

    it("builds a full Set-Cookie header", async () => {
      const res = await POST(
        makeReq({
          mode: "build",
          input: {
            name: "token",
            value: "xyz",
            path: "/",
            secure: true,
            http_only: true,
            same_site: "Lax",
          },
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.header).toContain("token=xyz");
      expect(data.header).toContain("Path=/");
      expect(data.header).toContain("Secure");
      expect(data.header).toContain("HttpOnly");
      expect(data.header).toContain("SameSite=Lax");
    });

    it("round-trips build -> parse", async () => {
      const buildRes = await POST(
        makeReq({
          mode: "build",
          input: {
            name: "auth",
            value: "tok123",
            path: "/app",
            secure: true,
            http_only: true,
            same_site: "None",
          },
        })
      );
      expect(buildRes.status).toBe(200);
      const { header } = await buildRes.json();

      const parseRes = await POST(makeReq({ mode: "parse", input: header }));
      expect(parseRes.status).toBe(200);
      const data = await parseRes.json();
      expect(data.auth.value).toBe("tok123");
      expect(data.auth.path).toBe("/app");
      expect(data.auth.secure).toBe(true);
      expect(data.auth.http_only).toBe(true);
      expect(data.auth.same_site).toBe("None");
    });

    it("rejects invalid same_site in build mode", async () => {
      const res = await POST(
        makeReq({ mode: "build", input: { name: "x", value: "1", same_site: "Bad" } })
      );
      expect(res.status).toBe(400);
    });
  });

  it("rejects unknown mode", async () => {
    const res = await POST(makeReq({ mode: "delete", input: "x=1" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/cookie-parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
