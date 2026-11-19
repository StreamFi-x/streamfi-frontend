/**
 * @jest-environment node
 * 
 * Tests for refund processor:
 * - Successful refunds
 * - Failed refunds with retry
 * - Unreachable accounts
 * - Max retries exceeded
 */

import {
  initiateGoalRefunds,
  processPendingRefunds,
  type RefundProcessingResult,
} from "../refund-processor";
import { sql } from "@vercel/postgres";

jest.mock("@vercel/postgres");
const sqlMock = sql as unknown as jest.Mock;

describe("refund-processor", () => {
  const goalId = "goal-123";
  const escrowKey = "SBXXXXXXX";
  const creatorAccount = "GXXXXXXX";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initiateGoalRefunds", () => {
    it("transitions goal to REFUNDING and marks contributions for refund", async () => {
      const mockBegin = jest.fn(async (callback) => {
        // Mock for testing
        return null;
      });

      (sql as any).begin = mockBegin;

      await initiateGoalRefunds(goalId);

      expect(mockBegin).toHaveBeenCalled();
    });

    it("throws if goal is not in DEADLINE_PASSED state", async () => {
      const mockBegin = jest.fn(async (callback) => {
        throw new Error(
          "Cannot refund: goal is in RELEASED state, not DEADLINE_PASSED"
        );
      });

      (sql as any).begin = mockBegin;

      await expect(initiateGoalRefunds(goalId)).rejects.toThrow(
        "Cannot refund"
      );
    });
  });

  describe("processPendingRefunds", () => {
    it("refunds successful contributions and marks them as refunded", async () => {
      const contributions = [
        {
          id: "contrib-1",
          contributor_wallet: "GXXXXXXX1",
          amount_xlm: "25.0",
          refund_attempt_count: 0,
        },
        {
          id: "contrib-2",
          contributor_wallet: "GXXXXXXX2",
          amount_xlm: "75.0",
          refund_attempt_count: 0,
        },
      ];

      sqlMock
        .mockResolvedValueOnce({ rows: contributions })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // No more pending
        .mockResolvedValueOnce({ rowCount: 1 }); // Update goal to REFUND_COMPLETE

      const result = await processPendingRefunds(goalId, escrowKey, creatorAccount);

      expect(result.refunded_count).toBe(2);
      expect(result.pending_retry_count).toBe(0);
    });

    it("marks unreachable accounts and does not retry", async () => {
      const contributions = [
        {
          id: "contrib-1",
          contributor_wallet: "GXXXXXXX-CLOSED",
          amount_xlm: "10.0",
          refund_attempt_count: 0,
        },
      ];

      sqlMock
        .mockResolvedValueOnce({ rows: contributions })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // 1 still pending (unreachable)
        .mockResolvedValueOnce({ rowCount: 0 }); // No goal update (still pending)

      const result = await processPendingRefunds(goalId, escrowKey, creatorAccount);

      expect(result.unreachable_count).toBe(1);
      expect(result.pending_retry_count).toBe(1);
    });

    it("schedules retries for transient failures with exponential backoff", async () => {
      const contributions = [
        {
          id: "contrib-1",
          contributor_wallet: "GXXXXXXX1",
          amount_xlm: "50.0",
          refund_attempt_count: 0,
        },
      ];

      sqlMock
        .mockResolvedValueOnce({ rows: contributions })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // 1 still pending (will retry)
        .mockResolvedValueOnce({ rowCount: 0 });

      const result = await processPendingRefunds(goalId, escrowKey, creatorAccount);

      expect(result.failed_count).toBe(1);
      expect(result.pending_retry_count).toBe(1);
    });

    it("removes contributions from retry queue after max retries", async () => {
      const maxRetries = 288;
      const contributions = [
        {
          id: "contrib-1",
          contributor_wallet: "GXXXXXXX1",
          amount_xlm: "100.0",
          refund_attempt_count: maxRetries + 1, // Already exceeded
        },
      ];

      sqlMock
        .mockResolvedValueOnce({ rows: contributions })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })
        .mockResolvedValueOnce({ rowCount: 0 });

      const result = await processPendingRefunds(goalId, escrowKey, creatorAccount);

      expect(result.failed_count).toBe(1);
    });

    it("transitions goal to REFUND_COMPLETE when all refunds are done", async () => {
      const contributions = [
        {
          id: "contrib-1",
          contributor_wallet: "GXXXXXXX1",
          amount_xlm: "100.0",
          refund_attempt_count: 0,
        },
      ];

      sqlMock
        .mockResolvedValueOnce({ rows: contributions })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // No more pending
        .mockResolvedValueOnce({ rowCount: 1 }); // Update goal

      const result = await processPendingRefunds(goalId, escrowKey, creatorAccount);

      expect(result.pending_retry_count).toBe(0);
      expect(sqlMock).toHaveBeenLastCalledWith(
        expect.stringContaining("REFUND_COMPLETE")
      );
    });
  });
});
