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
import { validateEmail } from "../_lib/helpers";

function makePost(body: object): Request {
  return new Request("http://localhost/api/routes-f/email-validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("validateEmail() helper", () => {
  it("normalizes gmail by lowercasing, stripping dots and plus tags", () => {
    const result = validateEmail("Foo.Bar+Promo@GMAIL.com");
    expect(result.normalized).toBe("foobar@gmail.com");
    expect(result.valid).toBe(true);
  });

  it("strips plus tags for non-gmail domains too", () => {
    const result = validateEmail("User+segment@example.com");
    expect(result.normalized).toBe("user@example.com");
  });

  it("marks role-based addresses", () => {
    const result = validateEmail("support@example.com");
    expect(result.is_role_based).toBe(true);
  });

  it("marks disposable domains", () => {
    const result = validateEmail("person@mailinator.com");
    expect(result.is_disposable).toBe(true);
  });

  it("detects disposable subdomains", () => {
    const result = validateEmail("person@mx.mailinator.com");
    expect(result.is_disposable).toBe(true);
  });

  it("returns reason for missing @", () => {
    const result = validateEmail("not-an-email");
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("MISSING_AT_SYMBOL");
  });

  it("returns reason for multiple @", () => {
    const result = validateEmail("a@b@c.com");
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("MULTIPLE_AT_SYMBOLS");
  });

  it("returns reason for unsupported quoted local-part", () => {
    const result = validateEmail('"quoted"@example.com');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("UNSUPPORTED_QUOTED_LOCAL_PART");
  });

  it("returns reason for consecutive local dots", () => {
    const result = validateEmail("foo..bar@example.com");
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("LOCAL_PART_CONSECUTIVE_DOTS");
  });

  it("returns reason for bad domain labels", () => {
    const result = validateEmail("ok@-bad-.com");
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("DOMAIN_LABEL_STARTS_OR_ENDS_WITH_HYPHEN");
  });

  it("returns reason for invalid tld", () => {
    const result = validateEmail("ok@example.c");
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("DOMAIN_TLD_INVALID");
  });
});

describe("POST /api/routes-f/email-validate", () => {
  it("returns validation payload", async () => {
    const res = await POST(makePost({ email: "admin@mailinator.com" }) as never);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toMatchObject({
      valid: true,
      is_disposable: true,
      is_role_based: true,
      normalized: "admin@mailinator.com",
    });
    expect(Array.isArray(data.reasons)).toBe(true);
  });

  it("returns syntax errors as reason codes", async () => {
    const res = await POST(makePost({ email: ".foo@example..com" }) as never);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.valid).toBe(false);
    expect(data.reasons).toEqual(
      expect.arrayContaining(["LOCAL_PART_STARTS_OR_ENDS_WITH_DOT", "DOMAIN_LABEL_EMPTY"]),
    );
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(makePost({}) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/routes-f/email-validate", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});
