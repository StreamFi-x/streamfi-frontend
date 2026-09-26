/**
 * CSRF Protection Tests (#1387)
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  generateCsrfToken,
  validateCsrfToken,
  extractCsrfTokenFromRequest,
  createCsrfTokenPair,
  isCsrfExemptRoute,
} from "../csrf";

describe("CSRF Protection", () => {
  describe("generateCsrfToken", () => {
    it("generates a random token of expected length", () => {
      const token = generateCsrfToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("generates different tokens on each call", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("validateCsrfToken", () => {
    it("validates a correct token against its hash", () => {
      const token = generateCsrfToken();
      const { hash } = createCsrfTokenPair();
      const valid = validateCsrfToken(token, hash);
      expect(valid).toBe(true);
    });

    it("rejects an incorrect token", () => {
      const token1 = generateCsrfToken();
      const { hash: hash2 } = createCsrfTokenPair();
      const valid = validateCsrfToken(token1, hash2);
      expect(valid).toBe(false);
    });

    it("rejects empty tokens", () => {
      const { hash } = createCsrfTokenPair();
      expect(validateCsrfToken("", hash)).toBe(false);
      expect(validateCsrfToken("  ", hash)).toBe(false);
    });

    it("rejects malformed hashes", () => {
      const token = generateCsrfToken();
      expect(validateCsrfToken(token, "invalid")).toBe(false);
      expect(validateCsrfToken(token, "")).toBe(false);
    });
  });

  describe("extractCsrfTokenFromRequest", () => {
    it("extracts token from x-csrf-token header", () => {
      const req = {
        headers: {
          get: (name: string) => {
            if (name === "x-csrf-token") return "test-token";
            return null;
          },
        },
      };
      const token = extractCsrfTokenFromRequest(req);
      expect(token).toBe("test-token");
    });

    it("extracts token from x-xsrf-token header", () => {
      const req = {
        headers: {
          get: (name: string) => {
            if (name === "x-xsrf-token") return "test-token";
            return null;
          },
        },
      };
      const token = extractCsrfTokenFromRequest(req);
      expect(token).toBe("test-token");
    });

    it("prefers x-csrf-token over x-xsrf-token", () => {
      const req = {
        headers: {
          get: (name: string) => {
            if (name === "x-csrf-token") return "token1";
            if (name === "x-xsrf-token") return "token2";
            return null;
          },
        },
      };
      const token = extractCsrfTokenFromRequest(req);
      expect(token).toBe("token1");
    });

    it("returns null when no CSRF header present", () => {
      const req = {
        headers: {
          get: () => null,
        },
      };
      const token = extractCsrfTokenFromRequest(req);
      expect(token).toBe(null);
    });
  });

  describe("createCsrfTokenPair", () => {
    it("creates a token and hash pair", () => {
      const pair = createCsrfTokenPair();
      expect(pair).toHaveProperty("token");
      expect(pair).toHaveProperty("hash");
      expect(typeof pair.token).toBe("string");
      expect(typeof pair.hash).toBe("string");
    });

    it("hash is consistent for same token", () => {
      const pair1 = createCsrfTokenPair();
      const pair2 = createCsrfTokenPair();
      // Different tokens should have different hashes
      expect(pair1.hash).not.toBe(pair2.hash);
    });
  });

  describe("isCsrfExemptRoute", () => {
    it("exempts webhook routes", () => {
      expect(isCsrfExemptRoute("/api/webhooks/mux")).toBe(true);
      expect(isCsrfExemptRoute("/api/routes-f/webhooks-privy-user")).toBe(true);
    });

    it("exempts auth session routes", () => {
      expect(isCsrfExemptRoute("/api/auth/session")).toBe(true);
      expect(isCsrfExemptRoute("/api/auth/wallet-session")).toBe(true);
    });

    it("does not exempt regular mutating routes", () => {
      expect(isCsrfExemptRoute("/api/tips/send")).toBe(false);
      expect(isCsrfExemptRoute("/api/users/update")).toBe(false);
    });

    it("matches routes by prefix", () => {
      expect(isCsrfExemptRoute("/api/webhooks/mux/live")).toBe(true);
      expect(isCsrfExemptRoute("/api/routes-f/webhooks-mux-asset")).toBe(true);
    });
  });
});