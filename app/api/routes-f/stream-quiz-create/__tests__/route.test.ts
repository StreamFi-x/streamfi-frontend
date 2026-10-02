import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/stream-quiz-create",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

const VALID_QUESTIONS = [
  {
    text: "What year was Stellar founded?",
    options: ["2012", "2014", "2016", "2018"],
    correct_answer_index: 1,
  },
  {
    text: "What is Soroban?",
    options: ["A wallet", "A smart contract platform", "A token"],
    correct_answer_index: 1,
  },
];

describe("POST /api/routes-f/stream-quiz-create", () => {
  it("creates a quiz and returns quizId", async () => {
    const res = await POST(
      makePost({ stream_id: "stream_1", questions: VALID_QUESTIONS })
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(typeof body.quizId).toBe("string");
    expect(body.quizId.length).toBeGreaterThan(0);
  });

  it("returns 400 when stream_id is missing", async () => {
    const res = await POST(makePost({ questions: VALID_QUESTIONS }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when questions is missing", async () => {
    const res = await POST(makePost({ stream_id: "stream_1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when questions is an empty array", async () => {
    const res = await POST(makePost({ stream_id: "stream_1", questions: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a question is missing text", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_1",
        questions: [{ options: ["A", "B"], correct_answer_index: 0 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when a question has fewer than 2 options", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_1",
        questions: [{ text: "Q?", options: ["A"], correct_answer_index: 0 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when correct_answer_index is out of range", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_1",
        questions: [
          { text: "Q?", options: ["A", "B"], correct_answer_index: 5 },
        ],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when correct_answer_index is negative", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_1",
        questions: [
          { text: "Q?", options: ["A", "B"], correct_answer_index: -1 },
        ],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when correct_answer_index is not an integer", async () => {
    const res = await POST(
      makePost({
        stream_id: "stream_1",
        questions: [
          { text: "Q?", options: ["A", "B"], correct_answer_index: 0.5 },
        ],
      })
    );
    expect(res.status).toBe(400);
  });

  it("generates a unique quizId for each created quiz", async () => {
    const res1 = await POST(
      makePost({ stream_id: "stream_1", questions: VALID_QUESTIONS })
    );
    const res2 = await POST(
      makePost({ stream_id: "stream_1", questions: VALID_QUESTIONS })
    );
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.quizId).not.toBe(body2.quizId);
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = new NextRequest(
      "http://localhost/api/routes-f/stream-quiz-create",
      { method: "POST", body: "not json", headers: { "Content-Type": "application/json" } }
    );
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });
});
