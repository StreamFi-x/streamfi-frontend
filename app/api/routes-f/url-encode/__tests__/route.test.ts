import { POST } from "../route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/url-encode";

function req(body: object) {
  return new NextRequest(BASE, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /url-encode", () => {
  it("encodes component mode by default", async () => {
    const res = await POST(req({ input: "a b/c", mode: "encode" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.output).toBe("a%20b%2Fc");
  });

  it("encodes full URL differently from component", async () => {
    const input = "https://example.com/a b?x=1&y=2";

    const componentRes = await POST(req({ input, mode: "encode", level: "component" }));
    const fullRes = await POST(req({ input, mode: "encode", level: "full" }));

    const component = (await componentRes.json()).output;
    const full = (await fullRes.json()).output;

    expect(component).not.toBe(full);
    expect(full).toContain("https://");
    expect(full).toContain("?");
    expect(component).toContain("https%3A%2F%2F");
  });

  it("supports decode in both levels", async () => {
    const componentRes = await POST(req({ input: "hello%20world", mode: "decode" }));
    expect(componentRes.status).toBe(200);
    expect((await componentRes.json()).output).toBe("hello world");

    const fullRes = await POST(
      req({ input: "https://example.com/a%20b?x=1&y=2", mode: "decode", level: "full" })
    );
    expect(fullRes.status).toBe(200);
    expect((await fullRes.json()).output).toBe("https://example.com/a b?x=1&y=2");
  });

  it("is round-trip lossless for component level", async () => {
    const original = "email+tag@example.com / x=y&z";

    const encoded = await POST(req({ input: original, mode: "encode", level: "component" }));
    const encodedValue = (await encoded.json()).output;

    const decoded = await POST(req({ input: encodedValue, mode: "decode", level: "component" }));
    expect((await decoded.json()).output).toBe(original);
  });

  it("returns 400 for malformed percent sequence on decode", async () => {
    const res = await POST(req({ input: "%E0%A4%A", mode: "decode", level: "component" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/malformed/i);
  });
});
