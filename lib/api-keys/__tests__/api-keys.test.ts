import {
  createApiKey,
  validateApiKey,
  revokeApiKey,
  rotateApiKey,
  listApiKeys,
  hashApiKey,
  _resetApiKeyMemoryStore,
  MAX_ACTIVE_KEYS_PER_USER,
  TIER_LIMITS,
} from "../index";
import {
  checkTieredRateLimit,
  _resetTieredRateLimitStore,
} from "@/lib/rate-limit";

describe("API Key Management and Tiering", () => {
  beforeEach(() => {
    _resetApiKeyMemoryStore();
    _resetTieredRateLimitStore();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Key Issuance and Secure Storage", () => {
    it("generates an API key with sf_live_ prefix and secure hash", async () => {
      const { apiKey, rawKey } = await createApiKey("user-1", "Test Integration", "free");

      expect(rawKey).toMatch(/^sf_live_[a-f0-9]{48}$/);
      expect(apiKey.name).toBe("Test Integration");
      expect(apiKey.tier).toBe("free");
      expect(apiKey.keyPrefix).toMatch(/^sf_live_[a-f0-9]{4}\.\.\.[a-f0-9]{4}$/);
      expect(apiKey.isRevoked).toBe(false);

      // Verify that hashing rawKey matches expected SHA-256
      const expectedHash = hashApiKey(rawKey);
      expect(expectedHash).toHaveLength(64);
    });

    it("lists API keys without exposing secrets or hashes", async () => {
      await createApiKey("user-1", "Key 1", "free");
      await createApiKey("user-1", "Key 2", "creator");

      const keys = await listApiKeys("user-1");
      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBeDefined();
      expect(keys[0].keyPrefix).toBeDefined();
      // Ensure rawKey or hash are not present on ApiKeyRecord
      expect((keys[0] as unknown as { rawKey?: string }).rawKey).toBeUndefined();
      expect((keys[0] as unknown as { keyHash?: string }).keyHash).toBeUndefined();
    });

    it("prevents exceeding max active keys per user account", async () => {
      for (let i = 0; i < MAX_ACTIVE_KEYS_PER_USER; i++) {
        await createApiKey("user-spammer", `Key ${i}`, "free");
      }

      await expect(
        createApiKey("user-spammer", "One Too Many", "free")
      ).rejects.toThrow(/Cannot exceed maximum of 5 active API keys/);
    });
  });

  describe("Key Validation, Revocation, and Rotation", () => {
    it("validates an active key and returns correct tier limits", async () => {
      const { rawKey } = await createApiKey("user-1", "Production", "creator");

      const result = await validateApiKey(rawKey);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.tier).toBe("creator");
        expect(result.limits.keyLimitPerMin).toBe(TIER_LIMITS.creator.keyLimitPerMin);
        expect(result.limits.accountLimitPerMin).toBe(TIER_LIMITS.creator.accountLimitPerMin);
      }
    });

    it("rejects invalid key format or non-existent keys", async () => {
      const formatRes = await validateApiKey("invalid_format_key");
      expect(formatRes.valid).toBe(false);

      const nonExistent = await validateApiKey("sf_live_0123456789abcdef0123456789abcdef0123456789abcdef");
      expect(nonExistent.valid).toBe(false);
    });

    it("revokes a key immediately, taking effect on subsequent validations", async () => {
      const { apiKey, rawKey } = await createApiKey("user-1", "To Revoke", "free");

      const validBefore = await validateApiKey(rawKey);
      expect(validBefore.valid).toBe(true);

      const revoked = await revokeApiKey("user-1", apiKey.id);
      expect(revoked).toBe(true);

      const validAfter = await validateApiKey(rawKey);
      expect(validAfter.valid).toBe(false);
      if (!validAfter.valid) {
        expect(validAfter.reason).toBe("key_revoked");
      }
    });

    it("rotates an API key: invalidates old key immediately and returns valid new key", async () => {
      const { apiKey: oldKey, rawKey: oldRawKey } = await createApiKey(
        "user-1",
        "Rotating Service",
        "partner"
      );

      const rotated = await rotateApiKey("user-1", oldKey.id);

      // Old key must be invalidated immediately
      const oldCheck = await validateApiKey(oldRawKey);
      expect(oldCheck.valid).toBe(false);
      if (!oldCheck.valid) {
        expect(oldCheck.reason).toBe("key_revoked");
      }

      // New key must be valid with same tier and name
      const newCheck = await validateApiKey(rotated.rawKey);
      expect(newCheck.valid).toBe(true);
      if (newCheck.valid) {
        expect(newCheck.tier).toBe("partner");
      }
      expect(rotated.apiKey.name).toBe("Rotating Service");
    });
  });

  describe("Rate-Limit Enforcement & Tiering", () => {
    it("enforces tier limits for free keys (e.g. 60 req/min)", async () => {
      const { rawKey } = await createApiKey("user-1", "Free Key", "free");

      const makeReq = () =>
        new Request("http://localhost/api/streams/viewers", {
          headers: { "x-api-key": rawKey },
        });

      // Send 60 allowed requests
      for (let i = 0; i < 60; i++) {
        const check = await checkTieredRateLimit(makeReq());
        expect(check.allowed).toBe(true);
        expect(check.tier).toBe("free");
      }

      // 61st request must be rate limited (429)
      const blocked = await checkTieredRateLimit(makeReq());
      expect(blocked.allowed).toBe(false);
      expect(blocked.errorResponse?.status).toBe(429);
      expect(blocked.headers["X-RateLimit-Tier"]).toBe("free");
    });

    it("enforces per-account aggregate limits across multiple keys", async () => {
      // User creates two free keys (each has keyLimit: 60, but accountLimit: 180)
      // If we use partner tier with account limit 3000, or test with small window:
      const { rawKey: key1 } = await createApiKey("user-multi", "Key 1", "free");
      const { rawKey: key2 } = await createApiKey("user-multi", "Key 2", "free");
      const { rawKey: key3 } = await createApiKey("user-multi", "Key 3", "free");
      const { rawKey: key4 } = await createApiKey("user-multi", "Key 4", "free");

      // Key 1 exhausts 60
      for (let i = 0; i < 60; i++) {
        const res = await checkTieredRateLimit(
          new Request("http://localhost/api/test", { headers: { "x-api-key": key1 } })
        );
        expect(res.allowed).toBe(true);
      }

      // Key 2 exhausts 60
      for (let i = 0; i < 60; i++) {
        const res = await checkTieredRateLimit(
          new Request("http://localhost/api/test", { headers: { "x-api-key": key2 } })
        );
        expect(res.allowed).toBe(true);
      }

      // Key 3 exhausts 60 (total 180 = accountLimitPerMin for free tier)
      for (let i = 0; i < 60; i++) {
        const res = await checkTieredRateLimit(
          new Request("http://localhost/api/test", { headers: { "x-api-key": key3 } })
        );
        expect(res.allowed).toBe(true);
      }

      // Now account aggregate limit (180) is exhausted!
      // Even with fresh Key 4, the request must be blocked by aggregate limit
      const blocked = await checkTieredRateLimit(
        new Request("http://localhost/api/test", { headers: { "x-api-key": key4 } })
      );
      expect(blocked.allowed).toBe(false);
      expect(blocked.errorResponse?.status).toBe(429);
      const json = await blocked.errorResponse?.json();
      expect(json.error).toMatch(/aggregate account rate limit exceeded/i);
    });

    it("falls back to backward-compatible IP rate limiting when no key is supplied", async () => {
      const makeReq = () =>
        new Request("http://localhost/api/streams/public", {
          headers: { "x-forwarded-for": "198.51.100.42" },
        });

      // Anonymous limit is 30
      for (let i = 0; i < 30; i++) {
        const res = await checkTieredRateLimit(makeReq());
        expect(res.allowed).toBe(true);
        expect(res.tier).toBe("anonymous");
      }

      const blocked = await checkTieredRateLimit(makeReq());
      expect(blocked.allowed).toBe(false);
      expect(blocked.tier).toBe("anonymous");
      expect(blocked.errorResponse?.status).toBe(429);
    });

    it("returns 401 when an invalid or revoked API key is supplied", async () => {
      const { apiKey, rawKey } = await createApiKey("user-1", "Revokable", "free");
      await revokeApiKey("user-1", apiKey.id);

      const res = await checkTieredRateLimit(
        new Request("http://localhost/api/streams/data", {
          headers: { Authorization: `Bearer ${rawKey}` },
        })
      );

      expect(res.allowed).toBe(false);
      expect(res.errorResponse?.status).toBe(401);
      const json = await res.errorResponse?.json();
      expect(json.error).toMatch(/invalid or revoked/i);
    });
  });
});
