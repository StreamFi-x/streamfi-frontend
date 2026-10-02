/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { sortByEndedAtDesc } from "../utils";
import { getGoalHistoryForCreator, tipGoalHistoryStore } from "../seedData";

function makeReq(creatorId?: string): NextRequest {
  const url = creatorId
    ? `http://localhost/api/routes-f/tip-goal-history?creator_id=${creatorId}`
    : "http://localhost/api/routes-f/tip-goal-history";
  return new NextRequest(url);
}

describe("GET /api/routes-f/tip-goal-history", () => {
  describe("Required Parameters", () => {
    it("returns 400 when creator_id is missing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("creator_id");
    });
  });

  describe("History for a creator", () => {
    it("returns all past goals for creator-alpha, most recent first", async () => {
      const res = await GET(makeReq("creator-alpha"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.goals).toHaveLength(3);
      expect(body.goals.map((g: { goal_id: string }) => g.goal_id)).toEqual([
        "goal_alpha_3",
        "goal_alpha_2",
        "goal_alpha_1",
      ]);
    });

    it("includes final status and total raised on each entry", async () => {
      const res = await GET(makeReq("creator-alpha"));
      const body = await res.json();

      const reached = body.goals.find(
        (g: { goal_id: string }) => g.goal_id === "goal_alpha_1"
      );
      expect(reached).toMatchObject({
        status: "reached",
        goal_usdc: 100,
        total_raised_usdc: 128,
      });

      const expired = body.goals.find(
        (g: { goal_id: string }) => g.goal_id === "goal_alpha_2"
      );
      expect(expired).toMatchObject({ status: "expired" });

      const cancelled = body.goals.find(
        (g: { goal_id: string }) => g.goal_id === "goal_alpha_3"
      );
      expect(cancelled).toMatchObject({ status: "cancelled" });
    });

    it("scopes results to the requested creator_id", async () => {
      const res = await GET(makeReq("creator-beta"));
      const body = await res.json();

      expect(body.goals).toHaveLength(1);
      expect(body.goals[0].goal_id).toBe("goal_beta_1");
    });

    it("returns an empty array for a creator with no history", async () => {
      const res = await GET(makeReq("creator-with-no-goals"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.goals).toEqual([]);
    });
  });

  describe("utils: sortByEndedAtDesc", () => {
    it("sorts by ended_at descending without mutating the input", () => {
      const input = getGoalHistoryForCreator("creator-alpha");
      const originalOrder = input.map(g => g.goal_id);
      const sorted = sortByEndedAtDesc(input);

      expect(sorted[0].ended_at >= sorted[1].ended_at).toBe(true);
      expect(sorted[1].ended_at >= sorted[2].ended_at).toBe(true);
      expect(input.map(g => g.goal_id)).toEqual(originalOrder);
    });

    it("handles an empty array", () => {
      expect(sortByEndedAtDesc([])).toEqual([]);
    });
  });

  describe("seedData", () => {
    it("has seed data loaded", () => {
      expect(tipGoalHistoryStore.length).toBeGreaterThan(0);
    });

    it("filters by creator_id", () => {
      const goals = getGoalHistoryForCreator("creator-alpha");
      expect(goals.every(g => g.creator_id === "creator-alpha")).toBe(true);
    });
  });
});
