import { NextRequest } from "next/server";
import { POST } from "../route";
import { quizStore } from "../../stream-quiz-create/seedData";
import type { Quiz } from "../../stream-quiz-create/types";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/stream-quiz-submit", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function seedQuiz(id: string, questions: Quiz["questions"]): void {
  quizStore.set(id, {
    quiz_id: id,
    stream_id: "stream_1",
    questions,
    created_at: new Date().toISOString(),
  });
}

const TWO_QUESTIONS: Quiz["questions"] = [
  { text: "Q1?", options: ["A", "B", "C"], correct_answer_index: 1 },
  { text: "Q2?", options: ["A", "B"], correct_answer_index: 0 },
];

describe("POST /api/routes-f/stream-quiz-submit", () => {
  beforeEach(() => {
    quizStore.clear();
  });

  it("scores a fully correct submission and ranks it first", async () => {
    seedQuiz("quiz_perfect", TWO_QUESTIONS);
    const res = await POST(
      makePost({ quizId: "quiz_perfect", viewer_id: "viewer_1", answer: [1, 0] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(2);
    expect(body.total).toBe(2);
    expect(body.rank).toBe(1);
  });

  it("scores a partially correct submission", async () => {
    seedQuiz("quiz_partial", TWO_QUESTIONS);
    const res = await POST(
      makePost({ quizId: "quiz_partial", viewer_id: "viewer_1", answer: [1, 1] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(1);
    expect(body.total).toBe(2);
  });

  it("ranks a higher scorer above a lower scorer", async () => {
    seedQuiz("quiz_rank", TWO_QUESTIONS);
    await POST(makePost({ quizId: "quiz_rank", viewer_id: "viewer_low", answer: [0, 1] })); // score 0
    const res = await POST(
      makePost({ quizId: "quiz_rank", viewer_id: "viewer_high", answer: [1, 0] })
    ); // score 2
    const body = await res.json();
    expect(body.score).toBe(2);
    expect(body.rank).toBe(1);
  });

  it("breaks a rank tie in favor of the earlier submitter", async () => {
    seedQuiz("quiz_tie", TWO_QUESTIONS);
    await POST(makePost({ quizId: "quiz_tie", viewer_id: "viewer_first", answer: [1, 1] })); // score 1, earlier
    const res = await POST(
      makePost({ quizId: "quiz_tie", viewer_id: "viewer_second", answer: [0, 0] })
    ); // score 1, later
    const body = await res.json();
    expect(body.score).toBe(1);
    expect(body.rank).toBe(2); // viewer_first (submitted earlier) ranks above
  });

  it("returns 404 for an unknown quizId (also covers an expired/removed quiz)", async () => {
    const res = await POST(
      makePost({ quizId: "does_not_exist", viewer_id: "viewer_1", answer: [0] })
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when the same viewer submits twice for the same quiz", async () => {
    seedQuiz("quiz_dup", TWO_QUESTIONS);
    await POST(makePost({ quizId: "quiz_dup", viewer_id: "viewer_1", answer: [1, 0] }));
    const res = await POST(
      makePost({ quizId: "quiz_dup", viewer_id: "viewer_1", answer: [1, 0] })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when answer length does not match the question count", async () => {
    seedQuiz("quiz_mismatch", TWO_QUESTIONS);
    const res = await POST(
      makePost({ quizId: "quiz_mismatch", viewer_id: "viewer_1", answer: [1] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when answer contains a non-integer entry", async () => {
    seedQuiz("quiz_bad_entry", TWO_QUESTIONS);
    const res = await POST(
      makePost({ quizId: "quiz_bad_entry", viewer_id: "viewer_1", answer: [1, 0.5] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when quizId is missing", async () => {
    const res = await POST(makePost({ viewer_id: "viewer_1", answer: [0] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when viewer_id is missing", async () => {
    seedQuiz("quiz_no_viewer", TWO_QUESTIONS);
    const res = await POST(makePost({ quizId: "quiz_no_viewer", answer: [1, 0] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answer is not an array", async () => {
    seedQuiz("quiz_bad_answer_type", TWO_QUESTIONS);
    const res = await POST(
      makePost({ quizId: "quiz_bad_answer_type", viewer_id: "viewer_1", answer: "nope" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    const badRequest = new NextRequest(
      "http://localhost/api/routes-f/stream-quiz-submit",
      { method: "POST", body: "not json", headers: { "Content-Type": "application/json" } }
    );
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });
});
