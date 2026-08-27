import { NextRequest } from "next/server";
import { POST } from "../route";
import { balanceStorage } from "../../channel-points/_lib/mock-storage";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-prediction-cancel",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/stream-prediction-cancel", () => {
  it("cancels an open prediction and refunds all staked points", async () => {
    const before1 = balanceStorage.getOrCreate("viewer_1", "creator_a").balance;
    const before2 = balanceStorage.getOrCreate("viewer_2", "creator_a").balance;
    const before3 = balanceStorage.getOrCreate("viewer_3", "creator_a").balance;

    const res = await POST(
      makePost({ prediction_id: "prediction_open_1", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.prediction.status).toBe("cancelled");
    expect(body.prediction.cancelled_at).not.toBeNull();
    expect(body.refunds).toHaveLength(3);

    expect(balanceStorage.get("viewer_1", "creator_a")?.balance).toBe(before1 + 200);
    expect(balanceStorage.get("viewer_2", "creator_a")?.balance).toBe(before2 + 100);
    expect(balanceStorage.get("viewer_3", "creator_a")?.balance).toBe(before3 + 150);
  });

  it("cancels a locked prediction and refunds its stakes", async () => {
    const res = await POST(
      makePost({ prediction_id: "prediction_locked_1", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prediction.status).toBe("cancelled");
    expect(body.refunds).toHaveLength(2);
  });

  it("returns 404 for an unknown prediction_id", async () => {
    const res = await POST(
      makePost({ prediction_id: "does_not_exist", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller is not a moderator for the stream", async () => {
    const res = await POST(
      makePost({ prediction_id: "prediction_open_1", moderator_id: "not_a_mod" })
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when the prediction has already resolved", async () => {
    const res = await POST(
      makePost({ prediction_id: "prediction_resolved_1", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when cancelling an already-cancelled prediction", async () => {
    await POST(makePost({ prediction_id: "prediction_open_1", moderator_id: "mod_1" }));
    const res = await POST(
      makePost({ prediction_id: "prediction_open_1", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when prediction_id is missing", async () => {
    const res = await POST(makePost({ moderator_id: "mod_1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when moderator_id is missing", async () => {
    const res = await POST(makePost({ prediction_id: "prediction_open_1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = new NextRequest(
      "http://localhost/api/routes-f/stream-prediction-cancel",
      { method: "POST", body: "not json", headers: { "Content-Type": "application/json" } }
    );
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });
});
