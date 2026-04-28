import { POST } from "../route";

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

function makePost(body: object): Request {
  return new Request("http://localhost/api/routes-f/redact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/redact", () => {
  it("redacts email by default", async () => {
    const res = await POST(makePost({ text: "mail me at test@example.com" }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.redacted).toContain("[REDACTED]");
    expect(data.found).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "email" })])
    );
  });

  it("redacts phone by default", async () => {
    const res = await POST(makePost({ text: "Call +1 (212) 555-0101 now" }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "phone" })])
    );
  });

  it("redacts ssn by default", async () => {
    const res = await POST(makePost({ text: "SSN: 123-45-6789" }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "ssn" })])
    );
  });

  it("redacts ip by default", async () => {
    const res = await POST(makePost({ text: "IP 192.168.0.1 is logged" }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "ip" })])
    );
  });

  it("redacts valid credit cards using Luhn check", async () => {
    const res = await POST(
      makePost({ text: "card: 4242 4242 4242 4242" }) as never
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "card" })])
    );
  });

  it("avoids false positive random digit strings for card", async () => {
    const res = await POST(
      makePost({ text: "random digits: 1234 5678 9012 3456" }) as never
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found.find((f: { type: string }) => f.type === "card")).toBeUndefined();
    expect(data.redacted).toBe("random digits: 1234 5678 9012 3456");
  });

  it("supports custom replacement", async () => {
    const res = await POST(
      makePost({ text: "email me a@b.com", replacement: "***" }) as never
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.redacted).toBe("email me ***");
  });

  it("supports selecting specific types", async () => {
    const res = await POST(
      makePost({ text: "mail a@b.com call 212-555-0101", types: ["email"] }) as never
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.found.length).toBe(1);
    expect(data.found[0].type).toBe("email");
    expect(data.redacted).toContain("[REDACTED]");
    expect(data.redacted).toContain("212-555-0101");
  });

  it("returns 400 for invalid text", async () => {
    const res = await POST(makePost({ text: 123 }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid types", async () => {
    const res = await POST(makePost({ text: "hello", types: ["unknown"] }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when text exceeds 1MB", async () => {
    const largeText = "a".repeat(1024 * 1024 + 1);
    const res = await POST(makePost({ text: largeText }) as never);
    expect(res.status).toBe(400);
  });
});
