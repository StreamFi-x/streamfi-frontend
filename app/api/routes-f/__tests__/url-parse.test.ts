/**
 * @jest-environment node
 */
import { POST } from "../url-parse/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/url-parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/routes-f/url-parse", () => {
  // --- Full URL with auth and query ---
  it("parses full URL with auth, query, and hash", async () => {
    const res = await POST(
      makeReq({
        url: "https://user:pass@example.com:8080/path/to/page?foo=bar&baz=qux#section",
      })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.protocol).toBe("https:");
    expect(d.host).toBe("example.com:8080");
    expect(d.hostname).toBe("example.com");
    expect(d.port).toBe("8080");
    expect(d.pathname).toBe("/path/to/page");
    expect(d.search).toBe("?foo=bar&baz=qux");
    expect(d.hash).toBe("#section");
    expect(d.username).toBe("user");
    expect(d.password).toBe("pass");
    expect(d.query.foo).toBe("bar");
    expect(d.query.baz).toBe("qux");
    expect(d.path_segments).toEqual(["path", "to", "page"]);
    expect(d.origin).toBe("https://example.com:8080");
  });

  // --- Repeated query keys become arrays ---
  it("handles repeated query keys as arrays", async () => {
    const res = await POST(
      makeReq({ url: "https://example.com?tag=a&tag=b&tag=c" })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.query.tag).toEqual(["a", "b", "c"]);
  });

  // --- Varied protocols ---
  it("parses ftp URL", async () => {
    const res = await POST(
      makeReq({ url: "ftp://files.example.com/pub/readme.txt" })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.protocol).toBe("ftp:");
    expect(d.hostname).toBe("files.example.com");
    expect(d.path_segments).toEqual(["pub", "readme.txt"]);
  });

  // --- Simple URL with no port/auth ---
  it("parses simple URL with default port", async () => {
    const res = await POST(
      makeReq({ url: "https://example.com/about" })
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.port).toBe("");
    expect(d.pathname).toBe("/about");
    expect(d.hash).toBe("");
    expect(d.search).toBe("");
  });

  // --- Invalid URL ---
  it("rejects invalid URL", async () => {
    const res = await POST(makeReq({ url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  // --- Missing url field ---
  it("rejects missing url field", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  // --- URL too long ---
  it("rejects URL exceeding 4KB", async () => {
    const longUrl = "https://example.com/" + "a".repeat(5000);
    const res = await POST(makeReq({ url: longUrl }));
    expect(res.status).toBe(400);
  });

  // --- Invalid JSON body ---
  it("rejects invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/url-parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // --- URL with empty path ---
  it("handles URL with empty path", async () => {
    const res = await POST(makeReq({ url: "https://example.com" }));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.pathname).toBe("/");
    expect(d.path_segments).toEqual([]);
  });
});
