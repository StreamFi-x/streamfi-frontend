import { NextRequest } from "next/server";
import { POST } from "./route";

function makeReq(hex: string) {
  return new NextRequest("http://localhost/api/routesF/mime-magic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hex }),
  });
}

describe("MIME Magic API", () => {
  it("detects PNG", async () => {
    const res = await POST(makeReq("89504e470d0a1a0a"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.mime).toBe("image/png");
    expect(data.extension).toBe("png");
  });

  it("detects JPEG", async () => {
    const res = await POST(makeReq("ffd8ffe000104a46"));
    const data = await res.json();
    expect(data.mime).toBe("image/jpeg");
    expect(data.extension).toBe("jpg");
  });

  it("detects GIF", async () => {
    const res = await POST(makeReq("474946383961"));
    const data = await res.json();
    expect(data.mime).toBe("image/gif");
  });

  it("detects PDF", async () => {
    const res = await POST(makeReq("255044462d312e34"));
    const data = await res.json();
    expect(data.mime).toBe("application/pdf");
  });

  it("detects ZIP", async () => {
    const res = await POST(makeReq("504b030414000000"));
    const data = await res.json();
    expect(data.mime).toBe("application/zip");
  });

  it("detects GZIP", async () => {
    const res = await POST(makeReq("1f8b0800"));
    const data = await res.json();
    expect(data.mime).toBe("application/gzip");
  });

  it("detects WebP", async () => {
    const res = await POST(makeReq("52494646e0730c00"));
    const data = await res.json();
    expect(data.mime).toBe("image/webp");
  });

  it("returns null for unknown bytes", async () => {
    const res = await POST(makeReq("deadbeef"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.mime).toBeNull();
    expect(data.extension).toBeNull();
    expect(data.matched).toBeNull();
  });

  it("returns 400 for empty hex", async () => {
    const res = await POST(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid hex", async () => {
    const res = await POST(makeReq("zzzz"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for odd-length hex", async () => {
    const res = await POST(makeReq("abc"));
    expect(res.status).toBe(400);
  });
});
