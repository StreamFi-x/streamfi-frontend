/**
 * @jest-environment node
 *
 * Tests for checkSubscriptionAccess with Soroban RPC:
 * - Active subscription (allowed)
 * - Lapsed subscription (denied)
 * - Never-existed subscription (denied)
 * - RPC unavailable (fail-closed: denied)
 * - No viewer public key (denied)
 */

import { checkSubscriptionAccess } from "../access";
import * as rpcClient from "../../subscriptions/rpc-client";

jest.mock("../../subscriptions/rpc-client");
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const { sql } = require("@vercel/postgres");

const streamerId = "streamer-user-id";
const viewerPublicKey =
  "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1";
const streamerWallet =
  "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2";

describe("checkSubscriptionAccess via Soroban RPC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows active subscription", async () => {
    sql.mockResolvedValueOnce({
      rows: [{ wallet: streamerWallet }],
    });
    (rpcClient.isSubscriptionActive as jest.Mock).mockResolvedValueOnce(true);

    const result = await checkSubscriptionAccess(streamerId, viewerPublicKey);

    expect(result.allowed).toBe(true);
    expect(rpcClient.isSubscriptionActive).toHaveBeenCalledWith(
      viewerPublicKey,
      streamerWallet
    );
  });

  it("denies lapsed subscription", async () => {
    sql.mockResolvedValueOnce({
      rows: [{ wallet: streamerWallet }],
    });
    (rpcClient.isSubscriptionActive as jest.Mock).mockResolvedValueOnce(false);

    const result = await checkSubscriptionAccess(streamerId, viewerPublicKey);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("subscription");
  });

  it("denies never-existed subscription", async () => {
    sql.mockResolvedValueOnce({
      rows: [{ wallet: streamerWallet }],
    });
    (rpcClient.isSubscriptionActive as jest.Mock).mockResolvedValueOnce(false);

    const result = await checkSubscriptionAccess(streamerId, viewerPublicKey);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("subscription");
  });

  it("denies when no viewer public key", async () => {
    const result = await checkSubscriptionAccess(streamerId, null);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("subscription");
    expect(sql).not.toHaveBeenCalled();
    expect(rpcClient.isSubscriptionActive).not.toHaveBeenCalled();
  });

  it("fails closed on RPC error", async () => {
    sql.mockResolvedValueOnce({
      rows: [{ wallet: streamerWallet }],
    });
    (rpcClient.isSubscriptionActive as jest.Mock).mockRejectedValueOnce(
      new Error("RPC unavailable")
    );

    const result = await checkSubscriptionAccess(streamerId, viewerPublicKey);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("rpc_error");
    expect((result as any).isError).toBe(true);
  });

  it("denies when streamer wallet not found", async () => {
    sql.mockResolvedValueOnce({
      rows: [], // No streamer found
    });

    const result = await checkSubscriptionAccess(streamerId, viewerPublicKey);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("subscription");
    expect(rpcClient.isSubscriptionActive).not.toHaveBeenCalled();
  });

  it("fails closed on wallet fetch error", async () => {
    sql.mockRejectedValueOnce(new Error("DB error"));

    const result = await checkSubscriptionAccess(streamerId, viewerPublicKey);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("database_error");
    expect((result as any).isError).toBe(true);
  });
});
