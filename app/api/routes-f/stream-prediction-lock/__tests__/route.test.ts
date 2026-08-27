import { NextRequest } from "next/server";
import { POST } from "../route";
import { predictionStore } from "../seedData";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-prediction-lock",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/routes-f/stream-prediction-lock", () => {
  it("locks an open prediction for an authorized moderator", async () => {
    const res = await POST(
      makePost({ prediction_id: "prediction_open_1", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.prediction.status).toBe("locked");
    expect(body.prediction.locked_by).toBe("mod_1");
    expect(body.prediction.locked_at).toEqual(expect.any(String));
    expect(predictionStore.get("prediction_open_1")?.status).toBe("locked");
  });

  it("returns 404 for an unknown prediction_id", async () => {
    const res = await POST(
      makePost({ prediction_id: "does_not_exist", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller is not a moderator for the stream", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_open_2",
        moderator_id: "mod_1",
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when the prediction is already locked", async () => {
    const res = await POST(
      makePost({
        prediction_id: "prediction_already_locked",
        moderator_id: "mod_1",
      })
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when the prediction is already resolved", async () => {
    const res = await POST(
      makePost({ prediction_id: "prediction_resolved", moderator_id: "mod_2" })
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

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-prediction-lock",
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not allow locking the same prediction twice", async () => {
    const first = await POST(
      makePost({ prediction_id: "prediction_open_2", moderator_id: "mod_3" })
    );
    expect(first.status).toBe(200);

    const second = await POST(
      makePost({ prediction_id: "prediction_open_2", moderator_id: "mod_3" })
    );
    expect(second.status).toBe(409);
  });
});
