/**
 * @jest-environment node
 */
const mockSql = jest.fn();
const mockVerifySession = jest.fn();
const mockBuildTip = jest.fn();
const mockSubmitTx = jest.fn();
const mockGetCurrentNetwork = jest.fn(() => "testnet");

jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

jest.mock("@/lib/stellar/payments", () => ({
  buildTipTransaction: (...args: unknown[]) => mockBuildTip(...args),
  submitTransaction: (...args: unknown[]) => mockSubmitTx(...args),
  getCurrentNetwork: () => mockGetCurrentNetwork(),
}));

jest.mock("@/lib/db/replica", () => ({
  markRecentWrite: jest.fn((response: Response) => response),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/tips/send/route";
import { markRecentWrite } from "@/lib/db/replica";

const SENDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const SENDER_KEY = "GSENDER123456789012345678901234567890123456789012345678";
const RECIPIENT_KEY = "GRECIPIENT123456789012345678901234567890123456789012345";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/tips/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tips/send (#1716, #1717)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    mockGetCurrentNetwork.mockReturnValue("testnet");
    mockVerifySession.mockResolvedValue({
      ok: true,
      userId: SENDER_ID,
      wallet: SENDER_KEY,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("blocks Stellar mainnet tips in preview deployments with 403 MAINNET_BLOCKED", async () => {
    process.env.VERCEL_ENV = "preview";
    mockGetCurrentNetwork.mockReturnValue("mainnet");

    const res = await POST(
      makeRequest({ destinationPublicKey: RECIPIENT_KEY, amount: "10" })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.code).toBe("MAINNET_BLOCKED");
    expect(body.details).toEqual({
      network: "mainnet",
      deploymentContext: "preview",
    });
    expect(mockSql).not.toHaveBeenCalled();
    expect(mockBuildTip).not.toHaveBeenCalled();
    expect(mockSubmitTx).not.toHaveBeenCalled();
  });

  it("returns canonical 400 error on invalid body", async () => {
    const res = await POST(
      makeRequest({ destinationPublicKey: RECIPIENT_KEY })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe("BAD_REQUEST");
    expect(body.error).toBe("Invalid request body");
  });

  it("returns canonical ApiSuccess envelope and marks recent write on success", async () => {
    mockSql
      .mockResolvedValueOnce({ rows: [{ stellar_public_key: SENDER_KEY }] })
      .mockResolvedValue({});
    mockBuildTip.mockResolvedValueOnce({
      hash: () => Buffer.from("abcd1234", "hex"),
    });
    mockSubmitTx.mockResolvedValueOnce({
      success: true,
      hash: "tx-hash-123",
      ledger: 99,
    });

    const res = await POST(
      makeRequest({ destinationPublicKey: RECIPIENT_KEY, amount: "10.0000000" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.transactionHash).toBe("tx-hash-123");
    expect(body.data.ledger).toBe(99);
    expect(body.transactionHash).toBe("tx-hash-123");
    expect(markRecentWrite).toHaveBeenCalledTimes(1);
  });
});
