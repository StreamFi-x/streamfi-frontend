import { NextRequest } from "next/server";
import { POST as submitQuestion, GET as getQueue } from "../route";
import { POST as answerQuestion } from "../answer/route";
import { POST as upvoteQuestion } from "../upvote/route";
import { resetStore } from "../_lib/store";

function makeRequest(method: string, body?: unknown, query?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/routes-f/qa");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  const init: RequestInit & { headers?: Record<string, string> } = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url.toString(), init);
}

function makeSubRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/routes-f/qa${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Submit question", () => {
  beforeEach(() => resetStore());

  it("submits a question and returns question_id and queued_at", async () => {
    const res = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "viewer-1", question: "What is this track?" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("question_id");
    expect(body).toHaveProperty("queued_at");
    expect(typeof body.question_id).toBe("string");
    expect(typeof body.queued_at).toBe("string");
  });

  it("rejects missing fields", async () => {
    const res = await submitQuestion(makeRequest("POST", { stream_id: "stream-1" }));
    expect(res.status).toBe(400);
  });
});

describe("Get queue", () => {
  beforeEach(() => resetStore());

  it("returns pending questions sorted by queued_at", async () => {
    await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "First?" })
    );
    await new Promise((r) => setTimeout(r, 5));
    await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v2", question: "Second?" })
    );

    const res = await getQueue(makeRequest("GET", undefined, { stream_id: "stream-1" }));
    const body = await res.json();
    expect(body.questions).toHaveLength(2);
    expect(body.questions[0].question).toBe("First?");
    expect(body.questions[1].question).toBe("Second?");
  });

  it("does not include answered questions", async () => {
    const res1 = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "Q1" })
    );
    await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v2", question: "Q2" })
    );
    const { question_id } = await res1.json();

    await answerQuestion(makeSubRequest("/answer", { question_id, creator_id: "creator-1" }));

    const qRes = await getQueue(makeRequest("GET", undefined, { stream_id: "stream-1" }));
    const body = await qRes.json();
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].question).toBe("Q2");
  });

  it("returns empty array for stream with no questions", async () => {
    const res = await getQueue(makeRequest("GET", undefined, { stream_id: "empty-stream" }));
    const body = await res.json();
    expect(body.questions).toEqual([]);
  });
});

describe("Answer question", () => {
  beforeEach(() => resetStore());

  it("marks a question as answered", async () => {
    const subRes = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "Q?" })
    );
    const { question_id } = await subRes.json();

    const ansRes = await answerQuestion(makeSubRequest("/answer", { question_id, creator_id: "creator-1" }));
    expect(ansRes.status).toBe(200);
    expect((await ansRes.json()).message).toBe("Marked as answered");
  });

  it("rejects answering already answered question", async () => {
    const subRes = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "Q?" })
    );
    const { question_id } = await subRes.json();

    await answerQuestion(makeSubRequest("/answer", { question_id, creator_id: "creator-1" }));
    const dupRes = await answerQuestion(makeSubRequest("/answer", { question_id, creator_id: "creator-1" }));
    expect(dupRes.status).toBe(409);
  });

  it("rejects answer for nonexistent question", async () => {
    const res = await answerQuestion(makeSubRequest("/answer", { question_id: "nonexistent", creator_id: "c1" }));
    expect(res.status).toBe(404);
  });
});

describe("Upvote question", () => {
  beforeEach(() => resetStore());

  it("increments score on upvote", async () => {
    const subRes = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "Q?" })
    );
    const { question_id } = await subRes.json();

    const upRes = await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v2" }));
    expect(upRes.status).toBe(200);
    const body = await upRes.json();
    expect(body.score).toBe(1);
  });

  it("rejects duplicate upvote from same viewer", async () => {
    const subRes = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "Q?" })
    );
    const { question_id } = await subRes.json();

    await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v2" }));
    const dupRes = await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v2" }));
    expect(dupRes.status).toBe(409);
  });

  it("allows multiple viewers to upvote the same question", async () => {
    const subRes = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "Q?" })
    );
    const { question_id } = await subRes.json();

    await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v2" }));
    await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v3" }));
    const upRes = await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v4" }));
    expect((await upRes.json()).score).toBe(3);
  });

  it("renders upvote count in queue response", async () => {
    const subRes = await submitQuestion(
      makeRequest("POST", { stream_id: "stream-1", viewer_id: "v1", question: "Q?" })
    );
    const { question_id } = await subRes.json();

    await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v2" }));
    await upvoteQuestion(makeSubRequest("/upvote", { question_id, viewer_id: "v3" }));

    const qRes = await getQueue(makeRequest("GET", undefined, { stream_id: "stream-1" }));
    const body = await qRes.json();
    expect(body.questions[0].upvotes).toBe(2);
  });

  it("rejects upvote for nonexistent question", async () => {
    const res = await upvoteQuestion(makeSubRequest("/upvote", { question_id: "nonexistent", viewer_id: "v1" }));
    expect(res.status).toBe(404);
  });
});
