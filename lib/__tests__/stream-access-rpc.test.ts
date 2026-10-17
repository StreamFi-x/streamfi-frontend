/**
 * @jest-environment node
 * 
 * Tests for canAccessStream with RPC-backed subscription checks:
 * - Public access (no gating)
 * - Share token access
 * - Creator self-access
 * - Active subscription via RPC
 * - Lapsed subscription (denied)
 * - Never-existed subscription (denied)
 * - RPC unavailable (fail-closed: denied)
 */

import { canAccessStream } from "../stream-access";
import * as rpcClient from "../subscriptions/rpc-client";

jest.mock("../subscriptions/rpc-client");
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const { sql } = require("@vercel/postgres");

const creatorUserId = "creator-user-id";
const viewerUserId = "viewer-user-id";
const creatorWallet = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1";
const viewerWallet = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2";

describe("canAccessStream with RPC subscriptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("public streams", () => {
    it("allows access to public streams", async () => {
      const result = await canAccessStream({
        privacy: "public",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe("unlisted streams", () => {
    it("denies access without token or ownership", async () => {
      const result = await canAccessStream({
        privacy: "unlisted",
        streamShareToken: "secret-token",
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("needs_invite_link");
    });

    it("allows access with matching share token", async () => {
      const token = "secret-token";
      const result = await canAccessStream({
        privacy: "unlisted",
        streamShareToken: token,
        providedToken: token,
        creatorUserId,
        viewerUserId: "other-user",
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("share_token");
    });

    it("allows creator to access own unlisted stream", async () => {
      const result = await canAccessStream({
        privacy: "unlisted",
        streamShareToken: "secret-token",
        providedToken: null,
        creatorUserId,
        viewerUserId: creatorUserId,
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("owner");
    });
  });

  describe("subscribers_only streams", () => {
    it("allows creator to access own subscribers-only stream", async () => {
      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: creatorUserId,
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("owner");
    });

    it("allows access with matching share token", async () => {
      const token = "secret-token";
      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: token,
        providedToken: token,
        creatorUserId,
        viewerUserId: "other-user",
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("share_token");
    });

    it("denies access without credentials", async () => {
      (rpcClient.isSubscriptionActive as jest.Mock).mockResolvedValueOnce(false);

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
        creatorWallet,
        viewerWallet,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("needs_subscription");
    });

    it("allows active subscription from RPC", async () => {
      (rpcClient.isSubscriptionActive as jest.Mock).mockResolvedValueOnce(true);

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
        creatorWallet,
        viewerWallet,
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("subscription");
      expect(rpcClient.isSubscriptionActive).toHaveBeenCalledWith(
        viewerWallet,
        creatorWallet
      );
    });

    it("denies lapsed subscription from RPC", async () => {
      (rpcClient.isSubscriptionActive as jest.Mock).mockResolvedValueOnce(false);

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
        creatorWallet,
        viewerWallet,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("needs_subscription");
    });

    it("fails closed on RPC error", async () => {
      (rpcClient.isSubscriptionActive as jest.Mock).mockRejectedValueOnce(
        new Error("RPC unavailable")
      );

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
        creatorWallet,
        viewerWallet,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("needs_subscription");
    });

    it("fetches wallet addresses from DB if not provided", async () => {
      (rpcClient.isSubscriptionActive as jest.Mock).mockResolvedValueOnce(true);
      sql.mockResolvedValueOnce({
        rows: [{ creator_wallet: creatorWallet, viewer_wallet: viewerWallet }],
      });

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
        // No wallet addresses provided
      });

      expect(result.allowed).toBe(true);
      expect(sql).toHaveBeenCalled();
      expect(rpcClient.isSubscriptionActive).toHaveBeenCalledWith(
        viewerWallet,
        creatorWallet
      );
    });

    it("denies when wallet addresses cannot be fetched from DB", async () => {
      sql.mockResolvedValueOnce({ rows: [] });

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("needs_subscription");
      expect(rpcClient.isSubscriptionActive).not.toHaveBeenCalled();
    });

    it("denies when wallet fetch fails", async () => {
      sql.mockRejectedValueOnce(new Error("DB error"));

      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: "other-user",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("needs_subscription");
    });
  });

  describe("access without viewer", () => {
    it("denies subscribers_only without viewerUserId", async () => {
      const result = await canAccessStream({
        privacy: "subscribers_only",
        streamShareToken: null,
        providedToken: null,
        creatorUserId,
        viewerUserId: null,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("needs_subscription");
      expect(rpcClient.isSubscriptionActive).not.toHaveBeenCalled();
    });
  });
});
