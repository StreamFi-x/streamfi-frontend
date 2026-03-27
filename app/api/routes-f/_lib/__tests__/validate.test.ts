/**
 * Unit tests for validateBody() and validateQuery() helpers.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { z } from "zod";
import { validateBody, validateQuery } from "../validate";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

// ── validateBody ───────────────────────────────────────────────────────────────

describe("validateBody()", () => {
  function makeRequest(body: unknown, contentType = "application/json") {
    return new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("returns { data } for a valid body", async () => {
    const result = await validateBody(makeRequest({ name: "Alice", age: 30 }), testSchema);
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns a 400 Response for an invalid body", async () => {
    const result = await validateBody(makeRequest({ name: "", age: -1 }), testSchema);
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("Validation failed");
      expect(Array.isArray(json.issues)).toBe(true);
      expect(json.issues.length).toBeGreaterThan(0);
    }
  });

  it("returns a 400 Response for malformed JSON", async () => {
    const result = await validateBody(makeRequest("{not json}", "text/plain"), testSchema);
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.error).toBe("Invalid JSON body");
    }
  });

  it("includes per-field error messages", async () => {
    const result = await validateBody(makeRequest({ name: "", age: 0 }), testSchema);
    if (result instanceof Response) {
      const json = await result.json();
      const fields = json.issues.map((i: { field: string }) => i.field);
      expect(fields).toContain("name");
      expect(fields).toContain("age");
    }
  });
});

// ── validateQuery ──────────────────────────────────────────────────────────────

describe("validateQuery()", () => {
  const querySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    q: z.string().optional(),
  });

  it("returns { data } for valid query params", () => {
    const params = new URLSearchParams({ limit: "50", q: "hello" });
    const result = validateQuery(params, querySchema);
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.data.limit).toBe(50);
      expect(result.data.q).toBe("hello");
    }
  });

  it("applies default values for missing optional params", () => {
    const params = new URLSearchParams();
    const result = validateQuery(params, querySchema);
    expect(result).not.toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      expect(result.data.limit).toBe(20);
    }
  });

  it("returns a 400 Response for invalid query params", () => {
    const params = new URLSearchParams({ limit: "999" });
    const result = validateQuery(params, querySchema);
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(400);
    }
  });
});
