/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("@/lib/routes-f/badges", () => ({
  evaluateAndAwardBadges: jest.fn(),
}));
jest.mock("@/lib/routes-f/price", () => ({ getXlmUsdPrice: jest.fn() }));
jest.mock("@/lib/stellar/tip-reconciliation", () => ({
  ...jest.requireActual("@/lib/stellar/tip-reconciliation"),
  reconcileUserTipTotals: jest.fn(),
}));

import { sql } from "@vercel/postgres";
import { evaluateAndAwardBadges } from "@/lib/routes-f/badges";
import { getXlmUsdPrice } from "@/lib/routes-f/price";
import {
  LedgerHistoryTooLargeError,
  reconcileUserTipTotals,
} from "@/lib/stellar/tip-reconciliation";
import { POST } from "../route";

const sqlMock = sql as unknown as jest.Mock;
const reconcile = reconcileUserTipTotals as jest.Mock;

function request(body: unknown) {
  return new Request("http://localhost/api/tips/refresh-total", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const USER = { id: "user-1", username: "alice", stellar_public_key: "GALICE" };

describe("POST /api/tips/refresh-total", () => {
  it("requires a username", async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it("returns 404 for an unknown user", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });
    expect((await POST(request({ username: "nobody" }))).status).toBe(404);
  });

  it("returns 400 when the user has no wallet", async () => {
    sqlMock.mockResolvedValueOnce({
      rows: [{ ...USER, stellar_public_key: "" }],
    });
    expect((await POST(request({ username: "alice" }))).status).toBe(400);
  });

  it("recalculates through the shared ledger logic and keeps the response shape", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] });
    reconcile.mockResolvedValueOnce({
      status: "updated",
      totals: {
        totalReceived: "12.5000000",
        totalCount: 3,
        lastTipAt: "2026-09-01T00:00:00Z",
      },
    });

    const res = await POST(request({ username: "Alice" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        username: "alice",
        totalReceived: "12.5000000",
        totalCount: 3,
        lastTipAt: "2026-09-01T00:00:00Z",
      })
    );
    expect(reconcile).toHaveBeenCalledWith("user-1", "GALICE", {
      getXlmUsdPrice,
      maxAttempts: 3,
    });
    expect(evaluateAndAwardBadges).toHaveBeenCalledWith("user-1");
  });

  it("returns 409 when concurrent writers kept winning", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] });
    reconcile.mockResolvedValueOnce({ status: "stale", totals: null });
    expect((await POST(request({ username: "alice" }))).status).toBe(409);
  });

  it("returns 422 instead of a partial total for an oversized history", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] });
    reconcile.mockRejectedValueOnce(new LedgerHistoryTooLargeError(100));
    expect((await POST(request({ username: "alice" }))).status).toBe(422);
  });

  it("returns 500 when Horizon fails", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [USER] });
    reconcile.mockRejectedValueOnce(new Error("horizon down"));
    expect((await POST(request({ username: "alice" }))).status).toBe(500);
  });
});
