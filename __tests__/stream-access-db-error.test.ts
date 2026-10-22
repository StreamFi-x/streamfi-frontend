/**
 * @jest-environment node
 */

import { canAccessStream } from "@/lib/stream-access";
import { checkSubscriptionAccess } from "@/lib/stream/access";

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const { sql } = require("@vercel/postgres");

describe("Stream access error distinction (#785)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("canAccessStream", () => {
    it("returns isError: true and reason: 'database_error' when wallet query throws", async () => {
      sql.mockRejectedValueOnce(new Error("Connection pool exhausted"));

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId: "creator-1",
        viewerUserId: "viewer-1",
      });

      expect(result.allowed).toBe(false);
      expect(result.isError).toBe(true);
      expect(result.reason).toBe("database_error");
    });
  });

  describe("checkSubscriptionAccess", () => {
    it("returns isError: true and reason: 'database_error' when DB query throws", async () => {
      sql.mockRejectedValueOnce(new Error("Postgres connection timeout"));

      const result = await checkSubscriptionAccess("creator-1", "GVIEWERKEY");

      expect(result.allowed).toBe(false);
      expect(result.isError).toBe(true);
      expect(result.reason).toBe("database_error");
    });
  });
});
