import { NextRequest } from "next/server";
import { POST } from "../route";
import { predictionStore, resetStore } from "../store";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-prediction-create",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

beforeEach(() => {
  resetStore();
});

describe("POST /api/routes-f/stream-prediction-create", () => {
  it("creates a prediction and returns its id and lock time", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Will the boss die first try?",
        outcomes: ["Yes", "No"],
        lock_after_sec: 60,
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(typeof body.prediction_id).toBe("string");
    expect(body.locks_at).toEqual(expect.any(String));

    const stored = predictionStore.get(body.prediction_id);
    expect(stored?.status).toBe("open");
    expect(stored?.outcomes).toEqual([
      { label: "Yes", points: 0 },
      { label: "No", points: 0 },
    ]);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await POST(
      makePost({ question: "Q?", outcomes: ["Yes", "No"], lock_after_sec: 60 })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when question is missing", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_a",
        outcomes: ["Yes", "No"],
        lock_after_sec: 60,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when outcomes has fewer than 2 entries", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Q?",
        outcomes: ["Yes"],
        lock_after_sec: 60,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when an outcome is an empty string", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Q?",
        outcomes: ["Yes", "  "],
        lock_after_sec: 60,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when outcomes exceeds the maximum", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Q?",
        outcomes: Array.from({ length: 11 }, (_, i) => `opt_${i}`),
        lock_after_sec: 60,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when lock_after_sec is missing", async () => {
    const res = await POST(
      makePost({ stream_id: "stream_a", question: "Q?", outcomes: ["Yes", "No"] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when lock_after_sec is zero or negative", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Q?",
        outcomes: ["Yes", "No"],
        lock_after_sec: 0,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when lock_after_sec exceeds the maximum", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Q?",
        outcomes: ["Yes", "No"],
        lock_after_sec: 24 * 60 * 60 + 1,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/stream-prediction-create",
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("assigns distinct ids to successive predictions", async () => {
    const first = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Q1?",
        outcomes: ["Yes", "No"],
        lock_after_sec: 30,
      })
    );
    const second = await POST(
      makePost({
        stream_id: "stream_a",
        question: "Q2?",
        outcomes: ["Yes", "No"],
        lock_after_sec: 30,
      })
    );

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.prediction_id).not.toBe(secondBody.prediction_id);
  });
});
