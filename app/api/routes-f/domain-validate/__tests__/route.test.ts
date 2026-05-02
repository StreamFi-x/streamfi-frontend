jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      json: (body: unknown, init?: ResponseInit) =>
        new Response(JSON.stringify(body), {
          status: init?.status ?? 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  };
});

import { POST } from "../route";
import { validateDomain } from "../_lib/validate";

function makePost(body: object): Request {
  return new Request("http://localhost/api/routes-f/domain-validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("validateDomain()", () => {
  it("validates a standard domain and parses parts", () => {
    const result = validateDomain("blog.example.com");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("blog.example.com");
    expect(result.parts).toEqual({
      subdomain: "blog",
      sld: "example",
      tld: "com",
    });
    expect(result.is_known_tld).toBe(true);
    expect(result.is_idn).toBe(false);
  });

  it("normalizes IDN and detects punycode usage", () => {
    const result = validateDomain("bücher.de");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("xn--bcher-kva.de");
    expect(result.is_idn).toBe(true);
    expect(result.tld).toBe("de");
  });

  it("returns valid true with unknown tld", () => {
    const result = validateDomain("example.unknownxyz");
    expect(result.valid).toBe(true);
    expect(result.is_known_tld).toBe(false);
    expect(result.tld).toBe("unknownxyz");
  });

  it("rejects invalid syntax", () => {
    expect(validateDomain("-bad.com").valid).toBe(false);
    expect(validateDomain("bad..com").valid).toBe(false);
    expect(validateDomain("bad-.com").valid).toBe(false);
    expect(validateDomain("localhost").valid).toBe(false);
  });
});

describe("POST /api/routes-f/domain-validate", () => {
  it("returns parsed domain details", async () => {
    const res = await POST(makePost({ domain: "Shop.Example.IO" }) as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      valid: true,
      normalized: "shop.example.io",
      tld: "io",
      is_known_tld: true,
      is_idn: false,
    });
  });

  it("rejects protocol-prefixed input", async () => {
    const res = await POST(makePost({ domain: "https://example.com" }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects ip input", async () => {
    const res = await POST(makePost({ domain: "127.0.0.1" }) as never);
    expect(res.status).toBe(400);
  });
});
