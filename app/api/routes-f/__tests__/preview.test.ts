/**
 * Tests for POST /api/routes-f/preview
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      }),
  },
}));

import { POST as previewPOST } from "../preview/route";

const makeRequest = (body?: unknown) =>
  new Request("http://localhost/api/routes-f/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const makeRawRequest = (rawBody: string) =>
  new Request("http://localhost/api/routes-f/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });

/** Helper: read response body reliably (avoids jsdom ReadableStream issues). */
async function jsonBody(res: Response) {
  const text = await res.text();
  return JSON.parse(text);
}

describe("POST /api/routes-f/preview", () => {
  it("returns 200 with transformed payload for valid minimal input", async () => {
    const payload = { name: "Route Alpha", path: "/alpha", method: "GET" };
    const res = await previewPOST(makeRequest(payload));
    expect(res.status).toBe(200);

    const body = await jsonBody(res);
    expect(body.preview).toBeDefined();
    expect(body.preview.name).toBe("Route Alpha");
    expect(body.preview.path).toBe("/alpha");
    expect(body.preview.method).toBe("GET");
    expect(body.preview.priority).toBe(0);
    expect(body.preview.enabled).toBe(true);
    expect(body.preview.tags).toEqual([]);
    expect(body.preview.slug).toBe("GET:/alpha");
    expect(body.preview.previewedAt).toBeDefined();
    expect(body.validation.isValid).toBe(true);
  });

  it("returns 200 with all optional fields preserved and tags normalized", async () => {
    const payload = {
      name: "  Route Beta  ",
      path: "/Beta",
      method: "POST",
      priority: 5,
      enabled: false,
      tags: ["Api", "api", " Cache ", "search"],
    };
    const res = await previewPOST(makeRequest(payload));
    expect(res.status).toBe(200);

    const body = await jsonBody(res);
    expect(body.preview.name).toBe("Route Beta");
    expect(body.preview.path).toBe("/beta");
    expect(body.preview.method).toBe("POST");
    expect(body.preview.priority).toBe(5);
    expect(body.preview.enabled).toBe(false);
    // duplicates removed, lowercased, trimmed
    expect(body.preview.tags).toEqual(["api", "cache", "search"]);
    expect(body.preview.slug).toBe("POST:/beta");
  });

  it("returns 422 when required field is missing", async () => {
    const payload = { path: "/test", method: "GET" }; // missing name
    const res = await previewPOST(makeRequest(payload));
    expect(res.status).toBe(422);

    const body = await jsonBody(res);
    expect(body.isValid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("returns 422 for invalid method", async () => {
    const payload = { name: "Bad", path: "/bad", method: "INVALID" };
    const res = await previewPOST(makeRequest(payload));
    expect(res.status).toBe(422);

    const body = await jsonBody(res);
    expect(body.isValid).toBe(false);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await previewPOST(makeRawRequest("{not-json!!!"));
    expect(res.status).toBe(400);

    const body = await jsonBody(res);
    expect(body.error).toBe("Invalid JSON payload");
  });

  it("sanitizes XSS content in name field", async () => {
    const payload = {
      name: '<script>alert("xss")</script>Route',
      path: "/safe",
      method: "GET",
    };
    const res = await previewPOST(makeRequest(payload));
    expect(res.status).toBe(200);

    const body = await jsonBody(res);
    expect(body.preview.name).not.toContain("<script>");
    expect(body.preview.name).toContain("Route");
  });
});
