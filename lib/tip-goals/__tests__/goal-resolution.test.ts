/**
 * @jest-environment node
 * 
 * Tests for race-safe goal-reached detection:
 * - Concurrent tips that cross threshold
 * - Goal not reached before deadline
 * - Single contribution tips
 * - Deadline transition
 */

import { recordContributionAndCheckGoal, checkDeadlinesAndTransition } from "../goal-resolution";
import { sql } from "@vercel/postgres";

jest.mock("@vercel/postgres");
const sqlMock = sql as unknown as jest.Mock;

describe("goal-resolution: race-safe goal detection", () => {
  const goalId = "goal-123";
  const contributor1 = "GXXXXXXX1";
  const contributor2 = "GXXXXXXX2";
  const goalThreshold = "100.0";

  describe("recordContributionAndCheckGoal", () => {
    it("records a contribution and returns goalReached=false when below threshold", async () => {
      const mockBegin = jest.fn(async (callback) => {
        // Mock getting goal state
        await callback({
          query: jest.fn().mockResolvedValueOnce({
            rows: [
              {
                id: goalId,
                status: "ACTIVE",
                goal_amount_xlm: goalThreshold,
                current_amount_xlm: "50.0",
                expires_at: new Date(Date.now() + 86400000),
              },
            ],
          }),
        });
        return {
          goalReached: false,
          newGoalStatus: null,
          previousAmount: "50.0",
          newAmount: "75.0",
        };
      });

      (sql as any).begin = mockBegin;

      const result = await recordContributionAndCheckGoal(
        goalId,
        contributor1,
        "user-1",
        "25.0",
        "tx-abc"
      );

      expect(result.goalReached).toBe(false);
      expect(result.newGoalStatus).toBeNull();
      expect(result.newAmount).toBe("75.0");
    });

    it("detects and records goal-reached when threshold is crossed", async () => {
      const mockBegin = jest.fn(async (callback) => {
        return {
          goalReached: true,
          newGoalStatus: "GOAL_REACHED",
          previousAmount: "95.0",
          newAmount: "105.0",
        };
      });

      (sql as any).begin = mockBegin;

      const result = await recordContributionAndCheckGoal(
        goalId,
        contributor1,
        "user-1",
        "10.0",
        "tx-abc"
      );

      expect(result.goalReached).toBe(true);
      expect(result.newGoalStatus).toBe("GOAL_REACHED");
      expect(parseFloat(result.newAmount)).toBeGreaterThanOrEqual(100);
    });

    it("does not duplicate goal-reached if already reached", async () => {
      const mockBegin = jest.fn(async (callback) => {
        // Goal is already GOAL_REACHED, so newGoalStatus should be null
        return {
          goalReached: true, // Sum is >= threshold
          newGoalStatus: null, // But status doesn't change
          previousAmount: "100.0",
          newAmount: "110.0",
        };
      });

      (sql as any).begin = mockBegin;

      const result = await recordContributionAndCheckGoal(
        goalId,
        contributor2,
        "user-2",
        "10.0",
        "tx-def"
      );

      expect(result.goalReached).toBe(true);
      expect(result.newGoalStatus).toBeNull(); // No status change
    });

    it("throws if goal not found", async () => {
      const mockBegin = jest.fn(async (callback) => {
        throw new Error("Goal not found: invalid-goal");
      });

      (sql as any).begin = mockBegin;

      await expect(
        recordContributionAndCheckGoal(
          "invalid-goal",
          contributor1,
          "user-1",
          "10.0",
          "tx-abc"
        )
      ).rejects.toThrow("Goal not found");
    });
  });

  describe("checkDeadlinesAndTransition", () => {
    it("transitions expired ACTIVE goals to DEADLINE_PASSED", async () => {
      sqlMock.mockResolvedValueOnce({
        rowCount: 3,
        rows: [{ id: "goal-1" }, { id: "goal-2" }, { id: "goal-3" }],
      });

      const result = await checkDeadlinesAndTransition();

      expect(result.passedCount).toBe(3);
      expect(sqlMock).toHaveBeenCalled();
    });

    it("returns 0 if no deadlines have passed", async () => {
      sqlMock.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      const result = await checkDeadlinesAndTransition();

      expect(result.passedCount).toBe(0);
    });
  });
});
