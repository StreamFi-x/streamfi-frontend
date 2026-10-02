import { NextRequest } from "next/server";
import { POST } from "../route";
import { balanceStorage } from "../../channel-points/_lib/mock-storage";
import { resetSeedData } from "../seedData";
import type { Payout } from "../types";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-prediction-resolve",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/stream-prediction-resolve", () => {
  beforeEach(() => {
    resetSeedData();
  });

  it("resolves a locked prediction and distributes the pot proportionally to winners", async () => {
    // prediction_locked_1: Yes pot = 300 (viewer_1: 200, viewer_2: 100), No pot = 150 (viewer_3)
    // winningOutcome = "Yes" -> losing pot 150 distributed proportional to winning stakes
    // viewer_1 share = 200/300 -> payout = 200 + (200/300)*150 = 200 + 100 = 300
    // viewer_2 share = 100/300 -> payout = 100 + (100/300)*150 = 100 + 50 = 150
    const before1 = balanceStorage.getOrCreate("viewer_1", "creator_a").balance;
    const before2 = balanceStorage.getOrCreate("viewer_2", "creator_a").balance;
    const before3 = balanceStorage.getOrCreate("viewer_3", "creator_a").balance;

    const res = await POST(
      makePost({
        prediction_id: "prediction_locked_1",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.prediction.status).toBe("resolved");
    expect(body.prediction.winning_outcome).toBe("Yes");
    expect(body.prediction.resolved_at).not.toBeNull();

    expect(body.payouts).toHaveLength(2);
    const v1Payout = body.payouts.find((p: Payout) => p.viewer_id === "viewer_1");
    const v2Payout = body.payouts.find((p: Payout) => p.viewer_id === "viewer_2");
    expect(v1Payout.points_paid).toBe(300);
    expect(v2Payout.points_paid).toBe(150);

    expect(balanceStorage.get("viewer_1", "creator_a")?.balance).toBe(before1 + 300);
    expect(balanceStorage.get("viewer_2", "creator_a")?.balance).toBe(before2 + 150);

    // losing viewer_3's balance is unchanged — they staked on "No" and lost
    expect(balanceStorage.get("viewer_3", "creator_a")?.balance).toBe(before3);
  });

  it("total points paid out equals the full pot (winning + losing stakes)", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_locked_1",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    const body = await res.json();
    const totalPaid = body.payouts.reduce((sum: number, p: Payout) => sum + p.points_paid, 0);
    expect(totalPaid).toBe(450); // 300 (Yes pot) + 150 (No pot)
  });

  it("does not distribute anything when nobody staked on the winning outcome", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_no_winners",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prediction.status).toBe("resolved");
    expect(body.payouts).toHaveLength(0);
  });

  it("resolves cleanly when there were no stakes at all", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_no_stakes",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payouts).toHaveLength(0);
  });

  it("returns 404 for an unknown prediction_id", async () => {
    const res = await POST(
      makePost({
        prediction_id: "does_not_exist",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller is not a moderator for the stream", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_locked_1",
        moderator_id: "not_a_mod",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when the prediction is still open (not yet locked)", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_open_1",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when the prediction has already been resolved", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_already_resolved",
        moderator_id: "mod_2",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 on a second resolve attempt for the same prediction", async () => {
    await POST(
      makePost({
        prediction_id: "prediction_locked_1",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    const res = await POST(
      makePost({
        prediction_id: "prediction_locked_1",
        moderator_id: "mod_1",
        winningOutcome: "Yes",
      })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when winningOutcome is not one of the prediction's outcomes", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_locked_1",
        moderator_id: "mod_1",
        winningOutcome: "Maybe",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when prediction_id is missing", async () => {
    const res = await POST(
      makePost({ moderator_id: "mod_1", winningOutcome: "Yes" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when moderator_id is missing", async () => {
    const res = await POST(
      makePost({ prediction_id: "prediction_locked_1", winningOutcome: "Yes" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when winningOutcome is missing", async () => {
    const res = await POST(
      makePost({ prediction_id: "prediction_locked_1", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = new NextRequest(
      "http://localhost/api/routes-f/stream-prediction-resolve",
      { method: "POST", body: "not json", headers: { "Content-Type": "application/json" } }
    );
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });
});
