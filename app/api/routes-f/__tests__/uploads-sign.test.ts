/**
 * Routes-F signed upload endpoint tests.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(body), {
        ...init,
        headers,
      });
    },
  },
}));

import { POST } from "../uploads/sign/route";

const makeRequest = (payload: unknown) =>
  new Request("http://localhost/api/routes-f/uploads/sign", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
  });

describe("POST /api/routes-f/uploads/sign", () => {
  it("returns 400 for invalid file metadata", async () => {
    const res = await POST(
      makeRequest({
        fileName: "clip.mov",
        fileType: "video/quicktime",
        fileSize: 1024,
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns signed upload payload with expected shape", async () => {
    const res = await POST(
      makeRequest({
        fileName: "stream.mp4",
        fileType: "video/mp4",
        fileSize: 12 * 1024 * 1024,
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe("PUT");
    expect(typeof body.url).toBe("string");
    expect(body.url).toContain("stream.mp4");
    expect(typeof body.expiresAt).toBe("string");
    expect(Number.isNaN(Date.parse(body.expiresAt))).toBe(false);
  });
});
