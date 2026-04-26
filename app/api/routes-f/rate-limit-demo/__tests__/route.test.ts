jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: init?.headers,
      }),
  },
}));

import { GET } from "../route";
import { __resetTokenBuckets } from "../_lib/token-bucket";

function makeRequest(ip = "192.0.2.10") {
  return new Request("http://localhost/api/routes-f/rate-limit-demo", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("GET /api/routes-f/rate-limit-demo", () => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    __resetTokenBuckets();
    nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("includes rate limit headers on successful responses", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("returns 429 on the eleventh request from the same IP", async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await GET(makeRequest());
      expect(response.status).toBe(200);
    }

    const blockedResponse = await GET(makeRequest());
    const blockedBody = await blockedResponse.json();

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(blockedResponse.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(blockedResponse.headers.get("Retry-After")).toBe("6");
    expect(blockedBody.error).toMatch(/rate limit exceeded/i);
  });

  it("updates Retry-After as the bucket refills", async () => {
    for (let index = 0; index < 10; index += 1) {
      await GET(makeRequest("198.51.100.40"));
    }

    nowSpy.mockReturnValue(1_700_000_003_000);
    const response = await GET(makeRequest("198.51.100.40"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
  });
});
