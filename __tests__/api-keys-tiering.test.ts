import { NextRequest } from "next/server";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  validateApiKey,
  hashApiKey,
  _resetMemoryStore,
} from "@/lib/api-keys/service";
import {
  checkRateLimit,
  enforceRateLimit,
  _resetRateLimitStore,
} from "@/lib/api-keys/rate-limiter";
import { TIER_LIMITS, MAX_ACTIVE_KEYS_PER_USER } from "@/lib/api-keys/tier-config";
import { GET, POST, DELETE } from "@/app/api/developer/keys/route";
import { POST as ROTATE_POST } from "@/app/api/developer/keys/rotate/route";
import { verifySession } from "@/lib/auth/verify-session";

// Mock @vercel/postgres so tests run with memory store fallback
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn().mockRejectedValue(new Error("Table api_keys not yet migrated in test")),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(),
}));

const verifySessionMock = verifySession as unknown as jest.Mock;

describe("Feature Issue #1438: API-key-based rate-limit tiering for third-party consumers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetMemoryStore();
    _resetRateLimitStore();

    verifySessionMock.mockResolvedValue({
      ok: true,
      userId: "user_developer_1",
      wallet: "0xDEV1",
      username: "developer_one",
    });
  });

  describe("API Key Issuance and Secure Hashing at Rest", () => {
    it("generates an API key and ensures the raw key is never stored in plaintext", async () => {
      const { apiKey, secretKey } = await createApiKey(
        "user_developer_1",
        "Stream Overlay Bot",
        "free"
      );

      // Raw key must have standard prefix
      expect(secretKey).toMatch(/^sf_live_[a-f0-9]{48}$/);

      // Public metadata returned
      expect(apiKey.name).toBe("Stream Overlay Bot");
      expect(apiKey.tier).toBe("free");
      expect(apiKey.status).toBe("active");
      expect(apiKey.keyPrefix).toBe(`${secretKey.slice(0, 16)}...`);

      // Verify hashing: raw key can be validated via SHA-256 hash lookup
      const validated = await validateApiKey(secretKey);
      expect(validated).not.toBeNull();
      expect(validated?.keyHash).toBe(hashApiKey(secretKey));
      // Hash is distinct from raw key
      expect(validated?.keyHash).not.toBe(secretKey);
    });

    it("enforces abuse prevention: caps active keys per account at 5", async () => {
      for (let i = 0; i < MAX_ACTIVE_KEYS_PER_USER; i++) {
        await createApiKey("user_developer_1", `Key #${i + 1}`);
      }

      // 6th key creation must fail
      await expect(
        createApiKey("user_developer_1", "Key #6")
      ).rejects.toThrow(/Active API key limit reached/i);
    });

    it("allows creating a new key after revoking an existing active key", async () => {
      const keys = [];
      for (let i = 0; i < MAX_ACTIVE_KEYS_PER_USER; i++) {
        keys.push(await createApiKey("user_developer_1", `Key #${i + 1}`));
      }

      // Revoke key #1
      await revokeApiKey("user_developer_1", keys[0].apiKey.id);

      // Now creation of another key succeeds
      const newKey = await createApiKey("user_developer_1", "Key Replacement");
      expect(newKey.apiKey.status).toBe("active");
    });
  });

  describe("Key Rotation and Immediate Revocation", () => {
    it("rotates an API key, immediately invalidating the old key and issuing a new one", async () => {
      const { apiKey: oldKey, secretKey: oldSecret } = await createApiKey(
        "user_developer_1",
        "Production Tooling",
        "creator"
      );

      // Verify old key works initially
      const preRotation = await validateApiKey(oldSecret);
      expect(preRotation?.status).toBe("active");

      // Rotate
      const rotated = await rotateApiKey("user_developer_1", oldKey.id);
      expect(rotated.oldKeyId).toBe(oldKey.id);
      expect(rotated.newApiKey.name).toBe("Production Tooling");
      expect(rotated.newApiKey.tier).toBe("creator");
      expect(rotated.newApiKey.id).not.toBe(oldKey.id);

      // OLD KEY MUST BE IMMEDIATELY INVALID
      const postRotationOld = await validateApiKey(oldSecret);
      expect(postRotationOld).toBeNull();

      // NEW KEY MUST BE ACTIVE
      const postRotationNew = await validateApiKey(rotated.secretKey);
      expect(postRotationNew).not.toBeNull();
      expect(postRotationNew?.status).toBe("active");
    });

    it("revokes an API key with immediate effect", async () => {
      const { apiKey, secretKey } = await createApiKey(
        "user_developer_1",
        "Temp Key"
      );

      const revoked = await revokeApiKey("user_developer_1", apiKey.id);
      expect(revoked.status).toBe("revoked");
      expect(revoked.revokedAt).toBeDefined();

      // Validation returns null immediately
      const check = await validateApiKey(secretKey);
      expect(check).toBeNull();
    });
  });

  describe("Tier Limits and Fallback Rate Limiting Enforcement", () => {
    it("falls back to IP-based rate limiting when no API key is provided", async () => {
      const req = new NextRequest("http://localhost/api/streams/live", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      });

      // Anonymous limit is 30 requests
      const limit = TIER_LIMITS.anonymous.requestsPerWindow;
      for (let i = 0; i < limit; i++) {
        const res = await checkRateLimit(req, { routeId: "test_anon" });
        expect(res.allowed).toBe(true);
        expect(res.tier).toBe("anonymous");
      }

      // Request 31 is throttled
      const throttled = await checkRateLimit(req, { routeId: "test_anon" });
      expect(throttled.allowed).toBe(false);
      expect(throttled.status).toBe(429);
      expect(throttled.tier).toBe("anonymous");
    });

    it("immediately rejects revoked or forged API keys with 401 Unauthorized", async () => {
      const req = new NextRequest("http://localhost/api/streams/live", {
        headers: { "x-api-key": "sf_live_invalid_forged_key_00000000000000000000000000000000" },
      });

      const res = await checkRateLimit(req);
      expect(res.allowed).toBe(false);
      expect(res.status).toBe(401);
      expect(res.error).toMatch(/invalid or revoked/i);
    });

    it("enforces higher tier rate limits for creator keys", async () => {
      const { secretKey } = await createApiKey(
        "user_creator_9",
        "OBS Overlay",
        "creator"
      );

      const req = new NextRequest("http://localhost/api/streams/live", {
        headers: { "x-api-key": secretKey },
      });

      // Creator tier allows 300 requests (much higher than 30 for IP)
      for (let i = 0; i < 70; i++) {
        const res = await checkRateLimit(req, { routeId: "test_creator" });
        expect(res.allowed).toBe(true);
        expect(res.tier).toBe("creator");
      }
    });

    it("enforces per-account aggregate limits to prevent quota-multiplication via multiple keys", async () => {
      // Free tier: 60 req/min per key, 100 req/min aggregate across account
      const key1 = await createApiKey("user_developer_1", "Key A", "free");
      const key2 = await createApiKey("user_developer_1", "Key B", "free");

      const req1 = new NextRequest("http://localhost/api/public/data", {
        headers: { "x-api-key": key1.secretKey },
      });
      const req2 = new NextRequest("http://localhost/api/public/data", {
        headers: { "x-api-key": key2.secretKey },
      });

      // Send 55 requests using Key A (below Key A's individual 60-limit)
      for (let i = 0; i < 55; i++) {
        const res = await checkRateLimit(req1, { routeId: "test_aggregate" });
        expect(res.allowed).toBe(true);
      }

      // Send 45 requests using Key B (55 + 45 = 100 total account requests)
      for (let i = 0; i < 45; i++) {
        const res = await checkRateLimit(req2, { routeId: "test_aggregate" });
        expect(res.allowed).toBe(true);
      }

      // Request #101 across the account (even though Key B only made 45 requests!) must be rejected
      const aggregateThrottled = await checkRateLimit(req2, {
        routeId: "test_aggregate",
      });
      expect(aggregateThrottled.allowed).toBe(false);
      expect(aggregateThrottled.status).toBe(429);
      expect(aggregateThrottled.error).toMatch(/account aggregate rate limit/i);
    });
  });

  describe("Developer Keys HTTP API Endpoints", () => {
    it("GET /api/developer/keys lists caller keys with sanitized metadata", async () => {
      await createApiKey("user_developer_1", "Bot 1", "free");
      await createApiKey("user_developer_1", "Bot 2", "creator");

      const req = new NextRequest("http://localhost/api/developer/keys");
      const res = await GET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.keys).toHaveLength(2);
      expect(data.keys[0]).not.toHaveProperty("keyHash");
      expect(data.keys[0]).not.toHaveProperty("secretKey");
      expect(data.keys[0].keyPrefix).toMatch(/^sf_live_/);
    });

    it("POST /api/developer/keys generates a new key with secretKey returned once", async () => {
      const req = new NextRequest("http://localhost/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Production Key", tier: "pro" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.apiKey.name).toBe("Production Key");
      expect(data.apiKey.tier).toBe("pro");
      expect(data.secretKey).toMatch(/^sf_live_/);
    });

    it("POST /api/developer/keys/rotate rotates a key", async () => {
      const initial = await createApiKey("user_developer_1", "Rotate Me", "free");

      const req = new NextRequest("http://localhost/api/developer/keys/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: initial.apiKey.id }),
      });

      const res = await ROTATE_POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.oldKeyId).toBe(initial.apiKey.id);
      expect(data.newApiKey.id).not.toBe(initial.apiKey.id);
      expect(data.secretKey).toBeDefined();
    });

    it("DELETE /api/developer/keys revokes key immediately", async () => {
      const initial = await createApiKey("user_developer_1", "Revoke Me", "free");

      const req = new NextRequest(
        `http://localhost/api/developer/keys?keyId=${initial.apiKey.id}`,
        { method: "DELETE" }
      );

      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.apiKey.status).toBe("revoked");

      // Verify key is rejected
      const validation = await validateApiKey(initial.secretKey);
      expect(validation).toBeNull();
    });
  });
});
