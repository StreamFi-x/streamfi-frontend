/**
 * Routes-F endpoints tests.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      }),
  },
}));

import { GET as healthGET } from "../health/route";
import { POST as validatePOST } from "../validate/route";
import { POST as importPOST } from "../import/route";
import { GET as preferencesGET, POST as preferencesPOST } from "../preferences/route";
import { POST as webhookPOST } from "../webhook/route";

const makeRequest = (method: string, path: string, body?: unknown, headers?: Record<string, string>) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const makeRawRequest = (method: string, path: string, rawBody: string, headers?: Record<string, string>) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: rawBody,
  });

describe("Routes-F response version", () => {
  it("health response includes apiVersion", async () => {
    const res = await healthGET(makeRequest("GET", "/api/routes-f/health"));
    const body = await res.json();
    expect(body.apiVersion).toBeDefined();
    expect(body.apiVersion).toBe("1");
  });

  it("validate success response includes apiVersion", async () => {
    const res = await validatePOST(
      makeRequest("POST", "/api/routes-f/validate", {
        name: "Route Alpha",
        path: "/alpha",
        method: "GET",
      })
    );
    const body = await res.json();
    expect(body.apiVersion).toBe("1");
  });

  it("validate error response includes apiVersion", async () => {
    const res = await validatePOST(
      makeRequest("POST", "/api/routes-f/validate", { path: "x", method: "INVALID" })
    );
    const body = await res.json();
    expect(body.apiVersion).toBe("1");
  });

  it("preferences GET response includes apiVersion", async () => {
    const res = await preferencesGET(
      makeRequest("GET", "/api/routes-f/preferences")
    );
    const body = await res.json();
    expect(body.apiVersion).toBe("1");
  });
});

describe("GET /api/routes-f/health", () => {
  it("returns ok status with no-store cache control", async () => {
    const res = await healthGET(makeRequest("GET", "/api/routes-f/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("adds x-request-id header when missing", async () => {
    const res = await healthGET(makeRequest("GET", "/api/routes-f/health"));
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
  });
});

describe("POST /api/routes-f/validate", () => {
  it("returns 200 for valid payload", async () => {
    const payload = { name: "Route Alpha", path: "/alpha", method: "GET" };
    const res = await validatePOST(
      makeRequest("POST", "/api/routes-f/validate", payload)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isValid).toBe(true);
  });

  it("returns 422 for invalid payload", async () => {
    const payload = { path: "alpha", method: "INVALID" };
    const res = await validatePOST(
      makeRequest("POST", "/api/routes-f/validate", payload)
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.isValid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe("POST /api/routes-f/import", () => {
  it("returns 207 when mixed validity", async () => {
    const payload = [
      { name: "Route A", path: "/a", method: "GET" },
      { name: "", path: "b", method: "POST" },
    ];
    const res = await importPOST(
      makeRequest("POST", "/api/routes-f/import", payload)
    );
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
  });

  it("returns 422 when all invalid", async () => {
    const payload = [{ name: "", path: "b", method: "POST" }];
    const res = await importPOST(
      makeRequest("POST", "/api/routes-f/import", payload)
    );
    expect(res.status).toBe(422);
  });
});

describe("/api/routes-f/preferences", () => {
  it("returns defaults on GET", async () => {
    const res = await preferencesGET(
      makeRequest("GET", "/api/routes-f/preferences")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toBeDefined();
  });

  it("rejects invalid keys on POST", async () => {
    const res = await preferencesPOST(
      makeRequest("POST", "/api/routes-f/preferences", { invalidKey: true })
    );
    expect(res.status).toBe(400);
  });

  it("accepts valid updates on POST", async () => {
    const res = await preferencesPOST(
      makeRequest("POST", "/api/routes-f/preferences", { compactMode: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences.compactMode).toBe(true);
  });
});

describe("POST /api/routes-f/webhook", () => {
  const secret = "test-secret";

  beforeAll(() => {
    process.env.ROUTES_F_WEBHOOK_SECRET = secret;
  });

  it("returns 401 for invalid signature", async () => {
    const res = await webhookPOST(
      makeRawRequest("POST", "/api/routes-f/webhook", "{}", {
        "x-signature": "bad-signature",
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 for valid signature", async () => {
    const payload = "{\"event\":\"test\"}";
    const crypto = await import("crypto");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const res = await webhookPOST(
      makeRawRequest("POST", "/api/routes-f/webhook", payload, {
        "x-signature": signature,
      })
    );

    expect(res.status).toBe(200);
  });
});
