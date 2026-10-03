/**
 * @jest-environment node
 */
const mockSql = jest.fn();
const mockVerifySession = jest.fn();
const mockBalance = jest.fn();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));
jest.mock("@/lib/stellar/balance", () => ({
  ...jest.requireActual("@/lib/stellar/balance"),
  getNativeBalance: (...args: unknown[]) => mockBalance(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/wallet/funding-status/route";
import { CircuitOpenError } from "@/lib/resilience/circuit-breaker";

const WALLET = `G${"CUSTODIAL".padEnd(55, "A")}`;
const request = () =>
  new NextRequest("http://localhost/api/wallet/funding-status");

beforeEach(() => {
  mockVerifySession.mockResolvedValue({ ok: true, userId: "u1" });
  mockSql.mockReset();
  mockBalance.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/wallet/funding-status", () => {
  it("requires a session", async () => {
    mockVerifySession.mockResolvedValue({
      ok: false,
      response: NextResponse.json({}, { status: 401 }),
    });
    expect((await GET(request())).status).toBe(401);
  });

  it("a custodial wallet that was never funded is eligible", async () => {
    mockSql.mockResolvedValue({ rows: [{ wallet: WALLET, custodial: true }] });
    mockBalance.mockResolvedValue({ balance: "0", activated: false });

    const res = await GET(request());
    expect(await res.json()).toEqual({
      walletType: "custodial",
      address: WALLET,
      activated: false,
      balance: "0",
      eligible: true,
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("a funded custodial wallet is not eligible", async () => {
    mockSql.mockResolvedValue({ rows: [{ wallet: WALLET, custodial: true }] });
    mockBalance.mockResolvedValue({ balance: "25.0000000", activated: true });
    expect(await (await GET(request())).json()).toMatchObject({
      eligible: false,
      activated: true,
    });
  });

  it("a custodial wallet spent down to its reserve is still not a first-timer", async () => {
    mockSql.mockResolvedValue({ rows: [{ wallet: WALLET, custodial: true }] });
    mockBalance.mockResolvedValue({ balance: "1.0000000", activated: true });
    expect(await (await GET(request())).json()).toMatchObject({
      eligible: false,
    });
  });

  it("a connected (non-custodial) wallet is never eligible and Horizon is not called", async () => {
    mockSql.mockResolvedValue({ rows: [{ wallet: WALLET, custodial: false }] });
    expect(await (await GET(request())).json()).toEqual({
      walletType: "external",
      address: WALLET,
      eligible: false,
    });
    expect(mockBalance).not.toHaveBeenCalled();
  });

  it("a user without a Stellar wallet is not eligible", async () => {
    mockSql.mockResolvedValue({ rows: [{ wallet: "0xabc", custodial: true }] });
    expect(await (await GET(request())).json()).toEqual({
      walletType: "none",
      address: null,
      eligible: false,
    });
  });

  it("answers 503 instead of guessing when Horizon is unavailable", async () => {
    mockSql.mockResolvedValue({ rows: [{ wallet: WALLET, custodial: true }] });
    mockBalance.mockRejectedValue(new CircuitOpenError("horizon", 1000));
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("15");
  });
});
