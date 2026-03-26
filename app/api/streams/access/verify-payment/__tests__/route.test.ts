/**
 * Tests for POST /api/streams/access/verify-payment
 * Mocks @vercel/postgres and Stellar Horizon calls.
 */

// Polyfill NextResponse.json for jsdom test environment
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const mockServerInstance = {
  transactions: jest.fn(),
  operations: jest.fn(),
};

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn(() => mockServerInstance),
    },
  };
});

import { sql } from "@vercel/postgres";
import { Keypair } from "@stellar/stellar-sdk";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;

const makeRequest = (body: object) =>
  new Request("http://localhost/api/streams/access/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

const makeStellarKey = () => Keypair.random().publicKey();

describe("POST /api/streams/access/verify-payment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER_TESTNET = makeStellarKey();
  });

  function mockHorizonTx(params: {
    source: string;
    memo: string;
  }) {
    mockServerInstance.transactions.mockReturnValue({
      transaction: () => ({
        call: async () => ({
          source_account: params.source,
          memo_type: "text",
          memo: params.memo,
        }),
      }),
    });
  }

  function mockHorizonPaymentOp(params: {
    to: string;
    amount: string;
    issuer: string;
  }) {
    mockServerInstance.operations.mockReturnValue({
      forTransaction: () => ({
        limit: () => ({
          call: async () => ({
            records: [
              {
                type: "payment",
                to: params.to,
                amount: params.amount,
                asset_type: "credit_alphanum4",
                asset_code: "USDC",
                asset_issuer: params.issuer,
              },
            ],
          }),
        }),
      }),
    });
  }

  it("returns 400 when required fields missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects duplicate tx_hash (replay protection)", async () => {
    const viewer = makeStellarKey();
    const streamerWallet = makeStellarKey();
    const streamerId = "streamer-uuid";

    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: streamerId, wallet: streamerWallet }] }) // streamer
      .mockResolvedValueOnce({
        rows: [{ access_type: "paid", config: { price_usdc: "25.00" } }],
      }) // config
      .mockResolvedValueOnce({ rows: [{ id: "grant-id" }] }); // dupe tx_hash

    const res = await POST(
      makeRequest({
        streamer_username: "alice",
        viewer_public_key: viewer,
        tx_hash: "abc123",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("verifies payment and inserts grant on success", async () => {
    const viewer = makeStellarKey();
    const streamerWallet = makeStellarKey();
    const streamerId = "streamer-uuid";
    const usdcIssuer = process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER_TESTNET!;

    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: streamerId, wallet: streamerWallet }] }) // streamer
      .mockResolvedValueOnce({
        rows: [{ access_type: "paid", config: { price_usdc: "25.00" } }],
      }) // config
      .mockResolvedValueOnce({ rows: [] }) // dupe tx_hash
      .mockResolvedValueOnce({ rows: [{ id: "viewer-uuid" }] }) // viewer
      .mockResolvedValueOnce({ rows: [] }); // insert

    mockHorizonTx({ source: viewer, memo: `streamfi-access:${streamerId}` });
    mockHorizonPaymentOp({ to: streamerWallet, amount: "25.0000000", issuer: usdcIssuer });

    const res = await POST(
      makeRequest({
        streamer_username: "alice",
        viewer_public_key: viewer,
        tx_hash: "txhash123",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

