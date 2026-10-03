import { NextRequest } from "next/server";
import { GET } from "@/app/api/tips/[username]/route";
import { getStellarExplorerUrl } from "@/lib/stellar/config";
import { sql } from "@vercel/postgres";

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const sqlMock = sql as unknown as jest.Mock;

describe("Bug Issue #1617: TipHistory component API route and Stellar explorer URL", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  });

  describe("GET /api/tips/[username]", () => {
    it("returns 400 when username is empty", async () => {
      const req = new NextRequest("http://localhost/api/tips/");
      const res = await GET(req, { params: Promise.resolve({ username: "" }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Username is required");
    });

    it("returns 404 when user is not found", async () => {
      sqlMock.mockResolvedValueOnce({ rows: [] });
      const req = new NextRequest("http://localhost/api/tips/nonexistent");
      const res = await GET(req, {
        params: Promise.resolve({ username: "nonexistent" }),
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("User not found");
    });

    it("returns paginated tips and totals when user is found", async () => {
      // 1. user lookup
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            username: "creator_bob",
            wallet: "G_CREATOR",
            total_tips_received: "150.5000000",
            total_tips_count: 5,
          },
        ],
      });
      // 2. tips lookup
      sqlMock.mockResolvedValueOnce({
        rows: [
          {
            id: "tip-101",
            amount_xlm: "50.00",
            tx_hash: "hash_abc",
            created_at: new Date("2026-09-25T10:00:00Z"),
            sender_wallet: "G_SUPPORTER_1",
            sender_username: "alice",
          },
          {
            id: "tip-100",
            amount_xlm: "100.50",
            tx_hash: "hash_def",
            created_at: new Date("2026-09-25T09:00:00Z"),
            sender_wallet: "G_SUPPORTER_2",
            sender_username: null,
          },
        ],
      });

      const req = new NextRequest("http://localhost/api/tips/creator_bob?limit=10");
      const res = await GET(req, {
        params: Promise.resolve({ username: "creator_bob" }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.tips).toHaveLength(2);
      expect(data.tips[0]).toEqual({
        id: "tip-101",
        sender: "G_SUPPORTER_1",
        senderUsername: "alice",
        amount: "50.00",
        asset: "XLM",
        txHash: "hash_abc",
        timestamp: "2026-09-25T10:00:00.000Z",
      });
      expect(data.total).toEqual({
        received: "150.5000000",
        count: 5,
      });
      expect(data.pagination.nextCursor).toBeNull();
    });
  });

  describe("Network-aware Stellar explorer URL", () => {
    it("returns testnet URL when NEXT_PUBLIC_STELLAR_NETWORK is testnet or not set", () => {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
      const url = getStellarExplorerUrl("tx", "hash123");
      expect(url).toBe("https://stellar.expert/explorer/testnet/tx/hash123");
    });

    it("returns public/mainnet URL when NEXT_PUBLIC_STELLAR_NETWORK is mainnet", () => {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
      const url = getStellarExplorerUrl("tx", "hash123");
      expect(url).toBe("https://stellar.expert/explorer/public/tx/hash123");
    });
  });
});
