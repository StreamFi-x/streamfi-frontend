/**
 * debug/env route tests (#1612).
 * The LIVEPEER_API_KEY preview leak was already removed upstream; this
 * covers the auth gate this route was still missing.
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      }),
  },
}));

import { GET } from "../route";

const makeRequest = (search?: string) =>
  new Request(`http://localhost/api/debug/env${search ?? ""}`, {
    method: "GET",
  });

const ORIGINAL_ENV = process.env;

describe("GET /api/debug/env", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns 403 when DEBUG_ENV_SECRET is not configured at all", async () => {
    delete process.env.DEBUG_ENV_SECRET;

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when the secret query param does not match", async () => {
    process.env.DEBUG_ENV_SECRET = "correct-secret";

    const res = await GET(makeRequest("?secret=wrong"));
    expect(res.status).toBe(403);
  });

  it("succeeds with the correct secret", async () => {
    process.env.DEBUG_ENV_SECRET = "correct-secret";
    process.env.POSTGRES_URL = "postgres://example";

    const res = await GET(makeRequest("?secret=correct-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.environment.POSTGRES_URL).toBe(true);
  });
});
