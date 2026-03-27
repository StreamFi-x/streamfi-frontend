/**
 * Tests for POST /api/routes-f/uploads/sign
 *
 * Mocks:
 *   - @aws-sdk/client-s3            — no real S3/R2 calls
 *   - @aws-sdk/s3-request-presigner — returns a deterministic fake URL
 *   - next/server                   — standard Response shim
 *   - @/lib/rate-limit              — always allows by default
 *   - @/lib/auth/verify-session     — controllable session
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

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => async () => false, // never rate-limited by default
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { verifySession } from "@/lib/auth/verify-session";
import { POST } from "../route";

const getSignedUrlMock = getSignedUrl as jest.Mock;
const verifySessionMock = verifySession as jest.Mock;
const S3ClientMock = S3Client as unknown as jest.Mock;
const PutObjectCommandMock = PutObjectCommand as unknown as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeRequest = (body?: object): import("next/server").NextRequest =>
  new Request("http://localhost/api/routes-f/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;

const authedSession = {
  ok: true as const,
  userId: "user-abc",
  wallet: null,
  privyId: "did:privy:abc",
  username: "testuser",
  email: "test@example.com",
};

const r2Env = {
  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "key-id",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_NAME: "streamfi-uploads",
  CDN_BASE_URL: "https://cdn.streamfi.media",
};

function setR2Env() {
  Object.assign(process.env, r2Env);
}

function clearR2Env() {
  for (const key of Object.keys(r2Env)) {
    delete process.env[key];
  }
}

let consoleErrorSpy: jest.SpyInstance;

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("POST /api/routes-f/uploads/sign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    verifySessionMock.mockResolvedValue(authedSession);
    getSignedUrlMock.mockResolvedValue(
      "https://test-account.r2.cloudflarestorage.com/avatars/user-abc/uuid.jpg?X-Amz-Signature=abc"
    );
    setR2Env();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    clearR2Env();
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  it("returns 401 when session is invalid", async () => {
    verifySessionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });
    const res = await POST(makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" }));
    expect(res.status).toBe(401);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/routes-f/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }) as unknown as import("next/server").NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 for invalid type", async () => {
    const res = await POST(
      makeRequest({ type: "video", filename: "clip.mp4", content_type: "image/jpeg" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/type must be one of/i);
  });

  it("returns 400 when filename is missing", async () => {
    const res = await POST(
      makeRequest({ type: "avatar", content_type: "image/jpeg" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/filename/i);
  });

  it("returns 400 when filename is an empty string", async () => {
    const res = await POST(
      makeRequest({ type: "avatar", filename: "   ", content_type: "image/jpeg" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/filename/i);
  });

  it("returns 400 when content_type is not allowed", async () => {
    const res = await POST(
      makeRequest({ type: "avatar", filename: "photo.gif", content_type: "image/gif" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/content_type must be one of/i);
    // Must list accepted types
    expect(body.error).toContain("image/jpeg");
    expect(body.error).toContain("image/png");
    expect(body.error).toContain("image/webp");
  });

  it("returns 400 when content_type is missing", async () => {
    const res = await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg" })
    );
    expect(res.status).toBe(400);
  });

  // ── R2 config ───────────────────────────────────────────────────────────────

  it("returns 500 when R2 env vars are not set", async () => {
    clearR2Env();
    const res = await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/storage is not configured/i);
  });

  it("returns 500 when only some R2 env vars are set", async () => {
    delete process.env.R2_SECRET_ACCESS_KEY;
    const res = await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    expect(res.status).toBe(500);
  });

  // ── Happy paths ─────────────────────────────────────────────────────────────

  it("returns 200 with upload_url, public_url, and expires_in for avatar", async () => {
    const res = await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upload_url).toBeDefined();
    expect(body.public_url).toBeDefined();
    expect(body.expires_in).toBe(300);
  });

  it("returns 200 for banner type", async () => {
    const res = await POST(
      makeRequest({ type: "banner", filename: "banner.png", content_type: "image/png" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expires_in).toBe(300);
  });

  it("returns 200 for thumbnail type", async () => {
    const res = await POST(
      makeRequest({ type: "thumbnail", filename: "thumb.webp", content_type: "image/webp" })
    );
    expect(res.status).toBe(200);
  });

  // ── Object key structure ────────────────────────────────────────────────────

  it("includes userId in the object key path", async () => {
    await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    const commandArg = PutObjectCommandMock.mock.calls[0][0];
    expect(commandArg.Key).toContain("user-abc");
    expect(commandArg.Key).toMatch(/^avatars\/user-abc\/.+\.jpg$/);
  });

  it("uses correct folder prefix for banner", async () => {
    await POST(
      makeRequest({ type: "banner", filename: "banner.png", content_type: "image/png" })
    );
    const commandArg = PutObjectCommandMock.mock.calls[0][0];
    expect(commandArg.Key).toMatch(/^banners\/user-abc\/.+\.png$/);
  });

  it("uses correct folder prefix for thumbnail", async () => {
    await POST(
      makeRequest({ type: "thumbnail", filename: "thumb.webp", content_type: "image/webp" })
    );
    const commandArg = PutObjectCommandMock.mock.calls[0][0];
    expect(commandArg.Key).toMatch(/^thumbnails\/user-abc\/.+\.webp$/);
  });

  it("sets the correct ContentType on the PutObjectCommand", async () => {
    await POST(
      makeRequest({ type: "avatar", filename: "photo.png", content_type: "image/png" })
    );
    const commandArg = PutObjectCommandMock.mock.calls[0][0];
    expect(commandArg.ContentType).toBe("image/png");
  });

  it("generates a unique UUID per request (two calls produce different keys)", async () => {
    await POST(makeRequest({ type: "avatar", filename: "a.jpg", content_type: "image/jpeg" }));
    await POST(makeRequest({ type: "avatar", filename: "b.jpg", content_type: "image/jpeg" }));
    const key1 = PutObjectCommandMock.mock.calls[0][0].Key;
    const key2 = PutObjectCommandMock.mock.calls[1][0].Key;
    expect(key1).not.toBe(key2);
  });

  // ── public_url construction ─────────────────────────────────────────────────

  it("constructs public_url from CDN_BASE_URL and object key", async () => {
    const res = await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    const body = await res.json();
    expect(body.public_url).toMatch(/^https:\/\/cdn\.streamfi\.media\/avatars\/user-abc\/.+\.jpg$/);
  });

  // ── S3 client configuration ─────────────────────────────────────────────────

  it("initialises S3Client with the R2 endpoint derived from R2_ACCOUNT_ID", async () => {
    await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    const s3Config = S3ClientMock.mock.calls[0][0];
    expect(s3Config.endpoint).toBe(
      "https://test-account.r2.cloudflarestorage.com"
    );
    expect(s3Config.region).toBe("auto");
    expect(s3Config.credentials.accessKeyId).toBe("key-id");
    expect(s3Config.credentials.secretAccessKey).toBe("secret-key");
  });

  it("passes expiresIn: 300 to getSignedUrl", async () => {
    await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    const options = getSignedUrlMock.mock.calls[0][2];
    expect(options.expiresIn).toBe(300);
  });

  // ── Error from presigner ────────────────────────────────────────────────────

  it("returns 500 when getSignedUrl throws", async () => {
    getSignedUrlMock.mockRejectedValueOnce(new Error("network failure"));
    const res = await POST(
      makeRequest({ type: "avatar", filename: "photo.jpg", content_type: "image/jpeg" })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to generate upload url/i);
  });
});
