import { createMuxStream, getMuxStream } from "@/lib/mux/server";
import { isMainnet, getStellarNetwork } from "@/lib/stellar/config";
import { hashPassword, verifyPassword } from "@/lib/stream-access/password";
import { fetchPaymentsReceived } from "@/lib/stellar/horizon";
import { callHorizon } from "@/lib/stellar/horizon-client";
import { handleMuxWebhook } from "@/lib/mux/webhook";

jest.mock("@/lib/resilience/breakers", () => ({
  getMuxBreaker: () => ({
    config: { timeoutMs: 5000 },
    execute: (fn: any) => fn(new AbortController().signal),
  }),
}));

const mockCreate = jest.fn();
const mockRetrieve = jest.fn();
jest.mock("@mux/mux-node", () => {
  return jest.fn().mockImplementation(() => ({
    video: {
      liveStreams: {
        create: mockCreate,
        retrieve: mockRetrieve,
      },
    },
  }));
});

jest.mock("@/lib/stellar/horizon-client", () => ({
  callHorizon: jest.fn(),
}));

describe("Issues #1618, #1616, #1615, #1614 verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Issue #1616: Signed Mux playback policy & password hashing & webhook prod guard", () => {
    it("createMuxStream includes signed playback policy when withSignedPlayback is true", async () => {
      mockCreate.mockResolvedValueOnce({
        id: "stream-123",
        stream_key: "key-123",
        status: "idle",
        playback_ids: [
          { id: "public-id-1", policy: "public" },
          { id: "signed-id-1", policy: "signed" },
        ],
      });

      const result = await createMuxStream({
        name: "test-stream",
        withSignedPlayback: true,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          playback_policy: ["public", "signed"],
        }),
        expect.anything()
      );
      expect(result.playbackId).toBe("public-id-1");
      expect(result.signedPlaybackId).toBe("signed-id-1");
    });

    it("getMuxStream retrieves signedPlaybackId if available", async () => {
      mockRetrieve.mockResolvedValueOnce({
        id: "stream-123",
        stream_key: "key-123",
        status: "active",
        playback_ids: [
          { id: "public-id-1", policy: "public" },
          { id: "signed-id-1", policy: "signed" },
        ],
      });

      const result = await getMuxStream("stream-123");
      expect(result.playbackId).toBe("public-id-1");
      expect(result.signedPlaybackId).toBe("signed-id-1");
    });

    it("hashPassword generates a salted hash and verifyPassword checks both salted and legacy hashes", () => {
      const password = "SuperSecretPassword123!";
      const hashedPassword = hashPassword(password);

      expect(hashedPassword).toContain(":");
      expect(verifyPassword(password, hashedPassword)).toBe(true);
      expect(verifyPassword("WrongPassword", hashedPassword)).toBe(false);

      // Verify backwards compatibility with legacy sha256
      const crypto = require("crypto");
      const legacySha256 = crypto.createHash("sha256").update(password).digest("hex");
      expect(verifyPassword(password, legacySha256)).toBe(true);
      expect(verifyPassword("WrongPassword", legacySha256)).toBe(false);
    });

    it("Mux webhook fails closed in production when MUX_WEBHOOK_SECRET is unset", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.MUX_WEBHOOK_SECRET;

      const req = new Request("http://localhost/api/webhooks/mux", {
        method: "POST",
        body: JSON.stringify({ type: "video.live_stream.active", data: { id: "stream-123" } }),
      });

      const response = await handleMuxWebhook(req, {
        endpoint: "webhooks/mux",
        handlers: {},
        missingObjectIdError: "Invalid event",
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Webhook signature secret is not configured");
    });
  });

  describe("Issue #1615: Stellar network configuration consistency", () => {
    it("isMainnet returns true for both mainnet and pubnet", () => {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
      expect(isMainnet()).toBe(true);
      expect(getStellarNetwork()).toBe("mainnet");

      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "pubnet";
      expect(isMainnet()).toBe(true);
      expect(getStellarNetwork()).toBe("mainnet");

      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
      expect(isMainnet()).toBe(false);
      expect(getStellarNetwork()).toBe("testnet");
    });
  });

  describe("Issue #1614: Horizon fetchPaymentsReceived without 'now' cursor on first page", () => {
    it("omits cursor when params.cursor is undefined", async () => {
      const mockCall = jest.fn().mockResolvedValue({
        records: [
          {
            id: "pay-1",
            type: "payment",
            from: "GSENDER",
            to: "GRECIPIENT",
            asset_type: "native",
            amount: "50.0000000",
            transaction_hash: "tx-1",
            created_at: "2026-09-27T00:00:00Z",
            ledger: 100,
            paging_token: "token-1",
          },
        ],
      });

      const mockBuilder: any = {
        forAccount: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        cursor: jest.fn().mockReturnThis(),
        call: mockCall,
      };

      const mockServer = {
        payments: jest.fn().mockReturnValue(mockBuilder),
      };

      (callHorizon as jest.Mock).mockImplementation(async (cb: any) => cb(mockServer));

      const result = await fetchPaymentsReceived({
        publicKey: "GRECIPIENT",
        limit: 10,
        order: "desc",
      });

      expect(mockBuilder.cursor).not.toHaveBeenCalled();
      expect(result.tips).toHaveLength(1);
      expect(result.tips[0].amount).toBe("50.0000000");
      expect(result.nextCursor).toBe("token-1");
    });
  });
});
