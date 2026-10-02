/**
 * Rate Limiting Policy Tests (#1386)
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  RATE_LIMIT_POLICIES,
  checkRateLimits,
  getClientIp,
} from "../rate-limit-policy";

// Mock the rate-limit module
jest.mock("@/lib/rate-limit", () => ({
  createRateLimit: jest.fn(() => ({
    check: jest.fn(),
  })),
  tooManyRequests: jest.fn(),
}));

describe("Rate Limiting Policy", () => {
  describe("RATE_LIMIT_POLICIES", () => {
    it("has defined policies for all route categories", () => {
      expect(RATE_LIMIT_POLICIES).toHaveProperty("auth");
      expect(RATE_LIMIT_POLICIES).toHaveProperty("tips");
      expect(RATE_LIMIT_POLICIES).toHaveProperty("streams");
      expect(RATE_LIMIT_POLICIES).toHaveProperty("users");
      expect(RATE_LIMIT_POLICIES).toHaveProperty("admin");
      expect(RATE_LIMIT_POLICIES).toHaveProperty("webhooks");
    });

    it("has sensible limits for auth routes", () => {
      expect(RATE_LIMIT_POLICIES.auth.session.limit).toBe(10);
      expect(RATE_LIMIT_POLICIES.auth.session.windowMs).toBe(60_000);
      expect(RATE_LIMIT_POLICIES.auth.magicLinkRequest.limit).toBe(5);
    });

    it("enables user limits for sensitive operations", () => {
      expect(RATE_LIMIT_POLICIES.tips.send.enableUserLimit).toBe(true);
      expect(RATE_LIMIT_POLICIES.tips.send.userLimit).toBe(10);
      expect(RATE_LIMIT_POLICIES.streams.chat.enableUserLimit).toBe(true);
    });

    it("has appropriate webhook limits", () => {
      expect(RATE_LIMIT_POLICIES.webhooks.mux.limit).toBe(120);
      expect(RATE_LIMIT_POLICIES.webhooks.mux.windowMs).toBe(60_000);
    });
  });

  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const req = {
        headers: {
          get: (name: string) => {
            if (name === "x-forwarded-for") return "192.168.1.1, 10.0.0.1";
            return null;
          },
        },
      };
      const ip = getClientIp(req);
      expect(ip).toBe("192.168.1.1");
    });

    it("extracts IP from x-real-ip header as fallback", () => {
      const req = {
        headers: {
          get: (name: string) => {
            if (name === "x-real-ip") return "192.168.1.1";
            return null;
          },
        },
      };
      const ip = getClientIp(req);
      expect(ip).toBe("192.168.1.1");
    });

    it("returns 'unknown' when no IP headers present", () => {
      const req = {
        headers: {
          get: () => null,
        },
      };
      const ip = getClientIp(req);
      expect(ip).toBe("unknown");
    });

    it("handles x-forwarded-for with single IP", () => {
      const req = {
        headers: {
          get: (name: string) => {
            if (name === "x-forwarded-for") return "192.168.1.1";
            return null;
          },
        },
      };
      const ip = getClientIp(req);
      expect(ip).toBe("192.168.1.1");
    });
  });

  describe("checkRateLimits", () => {
    let mockCheck: jest.Mock;

    beforeEach(() => {
      const { createRateLimit } = require("@/lib/rate-limit");
      mockCheck = jest.fn();
      createRateLimit.mockReturnValue({ check: mockCheck });
    });

    it("checks IP-based limit only when no user ID", async () => {
      mockCheck.mockResolvedValue({ success: true, limit: 10, remaining: 9, resetAt: Date.now() + 60000, retryAfterSeconds: 0, degraded: false });

      const result = await checkRateLimits(
        RATE_LIMIT_POLICIES.auth.session,
        "test-namespace",
        "192.168.1.1"
      );

      expect(result.allowed).toBe(true);
      expect(mockCheck).toHaveBeenCalledWith("192.168.1.1");
      expect(result.userResult).toBeUndefined();
    });

    it("checks both IP and user limits when user ID provided and policy enables it", async () => {
      mockCheck
        .mockResolvedValueOnce({ success: true, limit: 10, remaining: 9, resetAt: Date.now() + 60000, retryAfterSeconds: 0, degraded: false })
        .mockResolvedValueOnce({ success: true, limit: 5, remaining: 4, resetAt: Date.now() + 60000, retryAfterSeconds: 0, degraded: false });

      const result = await checkRateLimits(
        RATE_LIMIT_POLICIES.tips.send,
        "test-namespace",
        "192.168.1.1",
        "user-123"
      );

      expect(result.allowed).toBe(true);
      expect(mockCheck).toHaveBeenCalledTimes(2);
      expect(result.userResult).toBeDefined();
    });

    it("blocks when IP limit is exceeded", async () => {
      mockCheck.mockResolvedValue({ success: false, limit: 10, remaining: 0, resetAt: Date.now() + 60000, retryAfterSeconds: 60, degraded: false });

      const result = await checkRateLimits(
        RATE_LIMIT_POLICIES.auth.session,
        "test-namespace",
        "192.168.1.1"
      );

      expect(result.allowed).toBe(false);
    });

    it("blocks when user limit is exceeded even if IP limit passes", async () => {
      mockCheck
        .mockResolvedValueOnce({ success: true, limit: 10, remaining: 9, resetAt: Date.now() + 60000, retryAfterSeconds: 0, degraded: false })
        .mockResolvedValueOnce({ success: false, limit: 5, remaining: 0, resetAt: Date.now() + 60000, retryAfterSeconds: 60, degraded: false });

      const result = await checkRateLimits(
        RATE_LIMIT_POLICIES.tips.send,
        "test-namespace",
        "192.168.1.1",
        "user-123"
      );

      expect(result.allowed).toBe(false);
    });

    it("does not check user limit when policy does not enable it", async () => {
      mockCheck.mockResolvedValue({ success: true, limit: 10, remaining: 9, resetAt: Date.now() + 60000, retryAfterSeconds: 0, degraded: false });

      const result = await checkRateLimits(
        RATE_LIMIT_POLICIES.streams.viewers,
        "test-namespace",
        "192.168.1.1",
        "user-123"
      );

      expect(result.allowed).toBe(true);
      expect(mockCheck).toHaveBeenCalledTimes(1);
      expect(result.userResult).toBeUndefined();
    });
  });
});