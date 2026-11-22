/**
 * @jest-environment node
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

const mockSql = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

jest.mock("@/utils/send-email", () => ({
  sendWelcomeEmail: jest.fn(async () => true),
}));

import {
  API_VERSION_HEADER,
  CURRENT_API_VERSION,
  SUPPORTED_API_VERSIONS,
  apiBadRequest,
  apiConflict,
  apiCreated,
  apiError,
  apiForbidden,
  apiInternalError,
  apiMethodNotAllowed,
  apiNotFound,
  apiRateLimited,
  apiServiceUnavailable,
  apiSuccess,
  apiUnauthorized,
  apiV1,
  apiValidationError,
  apiVersionSunset,
  extractApiVersionFromPath,
  isApiError,
  isApiSuccess,
  isSupportedApiVersion,
  unwrapApiResponse,
  withApiVersion,
  withDeprecationHeaders,
} from "@/lib/api";
import { POST as waitlistSubscribe } from "@/app/api/waitlist/subscribe/route";
import { GET as debugEnv } from "@/app/api/debug/env/route";
import { GET as usersTop } from "@/app/api/users/top/route";
import { GET as streamsLive } from "@/app/api/streams/live/route";

describe("Shared ApiResponse builders & versioning utilities (#1717, #1718)", () => {
  beforeEach(() => {
    mockSql.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Response builders", () => {
    it("builds strict canonical success and created responses", async () => {
      const okRes = apiSuccess(
        { id: "123" },
        { message: "Loaded", meta: { requestId: "req-1" } }
      );
      expect(okRes.status).toBe(200);
      const okBody = await okRes.json();
      expect(okBody).toEqual({
        success: true,
        data: { id: "123" },
        message: "Loaded",
        meta: { requestId: "req-1" },
      });
      expect(isApiSuccess(okBody)).toBe(true);
      expect(isApiError(okBody)).toBe(false);
      expect(unwrapApiResponse(okBody)).toEqual({ id: "123" });

      const createdRes = apiCreated({ created: true });
      expect(createdRes.status).toBe(201);
      expect((await createdRes.json()).success).toBe(true);
    });

    it("supports transitional legacyFlat without allowing data to overwrite canonical envelope keys", async () => {
      const res = apiSuccess(
        { items: [1, 2], success: false, data: "evil" },
        { legacyFlat: true, message: "ok" }
      );
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.items).toEqual([1, 2]);
      expect(body.data).toEqual({
        items: [1, 2],
        success: false,
        data: "evil",
      });
      expect(body.message).toBe("ok");
    });

    it("builds canonical error responses across all status helpers", async () => {
      const cases = [
        [apiBadRequest("Bad input"), 400, "BAD_REQUEST"],
        [
          apiValidationError("Invalid body", [{ field: "email" }]),
          400,
          "VALIDATION_ERROR",
        ],
        [apiUnauthorized(), 401, "UNAUTHORIZED"],
        [apiForbidden(), 403, "FORBIDDEN"],
        [apiNotFound(), 404, "NOT_FOUND"],
        [apiMethodNotAllowed(["GET", "POST"]), 405, "METHOD_NOT_ALLOWED"],
        [apiConflict("Already exists"), 409, "CONFLICT"],
        [
          apiRateLimited("Slow down", { retryAfterSeconds: 30 }),
          429,
          "RATE_LIMITED",
        ],
        [
          apiServiceUnavailable("Down", { retryAfterSeconds: 15 }),
          503,
          "SERVICE_UNAVAILABLE",
        ],
        [apiInternalError(), 500, "INTERNAL_ERROR"],
        [
          apiError("Custom", { status: 422, code: "CUSTOM_CODE" }),
          422,
          "CUSTOM_CODE",
        ],
      ] as const;

      for (const [res, expectedStatus, expectedCode] of cases) {
        expect(res.status).toBe(expectedStatus);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.code).toBe(expectedCode);
        expect(typeof body.error).toBe("string");
        expect(isApiError(body)).toBe(true);
        expect(() => unwrapApiResponse(body)).toThrow(body.error);
      }

      const methodRes = apiMethodNotAllowed(["GET", "POST"]);
      expect(methodRes.headers.get("Allow")).toBe("GET, POST");
      const rateRes = apiRateLimited("Slow down", { retryAfterSeconds: 30 });
      expect(rateRes.headers.get("Retry-After")).toBe("30");
    });
  });

  describe("Versioning utilities", () => {
    it("identifies API versions from request paths", () => {
      expect(CURRENT_API_VERSION).toBe("v1");
      expect(SUPPORTED_API_VERSIONS).toEqual(["v1"]);
      expect(isSupportedApiVersion("v1")).toBe(true);
      expect(isSupportedApiVersion("v2")).toBe(false);

      expect(extractApiVersionFromPath("/api/v1/streams/live")).toBe("v1");
      expect(extractApiVersionFromPath("/api/v2/tips")).toBe("v2");
      expect(extractApiVersionFromPath("/api/streams/live")).toBe(
        "unversioned"
      );
      expect(extractApiVersionFromPath("/dashboard")).toBeNull();
    });

    it("attaches version and RFC 8594 deprecation headers", async () => {
      const res = withApiVersion(apiSuccess({ ok: true }), "v1");
      expect(res.headers.get(API_VERSION_HEADER)).toBe("v1");

      withDeprecationHeaders(res, {
        sunsetDate: "2027-06-01T00:00:00Z",
        successorPath: "/api/v2/streams/live",
        deprecatedAt: "2026-12-01T00:00:00Z",
      });
      expect(res.headers.get("Deprecation")).toMatch(/^@\d+$/);
      expect(res.headers.get("Sunset")).toContain("2027");
      expect(res.headers.get("Link")).toBe(
        '</api/v2/streams/live>; rel="successor-version"'
      );
    });

    it("produces 410 Gone for retired versions and strict v1 envelopes via apiV1", async () => {
      const sunsetRes = apiVersionSunset("v0", "/api/v1/streams/live");
      expect(sunsetRes.status).toBe(410);
      expect(sunsetRes.headers.get("Link")).toBe(
        '</api/v1/streams/live>; rel="successor-version"'
      );
      const sunsetBody = await sunsetRes.json();
      expect(sunsetBody).toMatchObject({
        success: false,
        code: "API_VERSION_SUNSET",
      });

      const v1Res = apiV1.success({ hello: "world" });
      expect(v1Res.headers.get(API_VERSION_HEADER)).toBe("v1");
      const v1Body = await v1Res.json();
      expect(v1Body).toEqual({
        success: true,
        data: { hello: "world" },
        meta: { apiVersion: "v1" },
      });
      expect(v1Body.hello).toBeUndefined();
    });
  });

  describe("Consistency across migrated routes", () => {
    it("waitlist/subscribe returns canonical success and failure shapes", async () => {
      const badRes = await waitlistSubscribe(
        new Request("http://localhost/api/waitlist/subscribe", {
          method: "POST",
          body: JSON.stringify({}),
        }) as unknown as import("next/server").NextRequest
      );
      expect(badRes.status).toBe(400);
      expect(await badRes.json()).toEqual({
        success: false,
        error: "Email is required",
        code: "BAD_REQUEST",
      });

      mockSql
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const okRes = await waitlistSubscribe(
        new Request("http://localhost/api/waitlist/subscribe", {
          method: "POST",
          body: JSON.stringify({ email: "fan@example.com" }),
        }) as unknown as import("next/server").NextRequest
      );
      expect(okRes.status).toBe(201);
      const okBody = await okRes.json();
      expect(okBody.success).toBe(true);
      expect(okBody.data).toEqual({ alreadySubscribed: false });
      expect(okBody.message).toBe("Successfully subscribed to waitlist");
    });

    it("debug/env returns canonical failure and success shapes", async () => {
      delete process.env.DEBUG_ENV_SECRET;
      const failRes = await debugEnv(
        new Request("http://localhost/api/debug/env")
      );
      expect(failRes.status).toBe(403);
      expect(await failRes.json()).toMatchObject({
        success: false,
        code: "FORBIDDEN",
      });

      process.env.DEBUG_ENV_SECRET = "s3cr3t";
      const okRes = await debugEnv(
        new Request("http://localhost/api/debug/env?secret=s3cr3t")
      );
      expect(okRes.status).toBe(200);
      const okBody = await okRes.json();
      expect(okBody.success).toBe(true);
      expect(okBody.data.environment).toBeDefined();
      expect(okBody.environment).toEqual(okBody.data.environment);
    });

    it("users/top and streams/live return canonical success and error envelopes", async () => {
      mockSql.mockResolvedValueOnce({
        rows: [
          {
            username: "alice",
            avatar: null,
            is_live: false,
            current_viewers: 0,
            follower_count: 5,
          },
        ],
      });
      const usersRes = await usersTop(
        new Request(
          "http://localhost/api/users/top"
        ) as unknown as import("next/server").NextRequest
      );
      expect(usersRes.status).toBe(200);
      const usersBody = await usersRes.json();
      expect(usersBody.success).toBe(true);
      expect(usersBody.data.users).toHaveLength(1);
      expect(usersBody.users).toHaveLength(1);

      mockSql.mockRejectedValueOnce(new Error("DB fail"));
      const liveErrRes = await streamsLive(
        new Request("http://localhost/api/streams/live")
      );
      expect(liveErrRes.status).toBe(500);
      expect(await liveErrRes.json()).toEqual({
        success: false,
        error: "Failed to fetch live streams",
        code: "INTERNAL_ERROR",
      });
    });
  });
});
