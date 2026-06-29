import { NextRequest } from "next/server";
import { POST as createPoll, GET as getPoll } from "../route";
import { POST as votePoll } from "../vote/route";
import { resetStore, getStore } from "../_lib/store";

function makeRequest(method: string, body?: unknown, query?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/routes-f/polls");
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

function makeVoteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/polls/vote", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("Poll creation", () => {
  beforeEach(() => resetStore());

  it("creates a poll and returns poll_id and ends_at", async () => {
    const res = await createPoll(
      makeRequest("POST", {
        stream_id: "stream-1",
        question: "Best track?",
        options: ["Track A", "Track B", "Track C"],
        duration_seconds: 60,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("poll_id");
    expect(body).toHaveProperty("ends_at");
    expect(typeof body.poll_id).toBe("string");
    expect(typeof body.ends_at).toBe("string");
  });

  it("rejects fewer than 2 options", async () => {
    const res = await createPoll(
      makeRequest("POST", {
        stream_id: "stream-1",
        question: "Best track?",
        options: ["Only one"],
        duration_seconds: 60,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects more than 6 options", async () => {
    const res = await createPoll(
      makeRequest("POST", {
        stream_id: "stream-1",
        question: "Best track?",
        options: ["A", "B", "C", "D", "E", "F", "G"],
        duration_seconds: 60,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing required fields", async () => {
    const res = await createPoll(
      makeRequest("POST", { stream_id: "stream-1" })
    );
    expect(res.status).toBe(400);
  });
});

describe("Get poll", () => {
  let pollId: string;

  beforeEach(async () => {
    resetStore();
    const res = await createPoll(
      makeRequest("POST", {
        stream_id: "stream-1",
        question: "Best track?",
        options: ["Track A", "Track B"],
        duration_seconds: 60,
      })
    );
    pollId = (await res.json()).poll_id;
  });

  it("returns poll details with zero votes initially", async () => {
    const res = await getPoll(makeRequest("GET", undefined, { poll_id: pollId }));
    const body = await res.json();
    expect(body.question).toBe("Best track?");
    expect(body.options).toEqual([
      { text: "Track A", votes: 0 },
      { text: "Track B", votes: 0 },
    ]);
    expect(body.total_votes).toBe(0);
    expect(body.ended).toBe(false);
  });

  it("returns 404 for unknown poll", async () => {
    const res = await getPoll(makeRequest("GET", undefined, { poll_id: "nonexistent" }));
    expect(res.status).toBe(404);
  });
});

describe("Voting", () => {
  let pollId: string;

  beforeEach(async () => {
    resetStore();
    const res = await createPoll(
      makeRequest("POST", {
        stream_id: "stream-1",
        question: "Best track?",
        options: ["Track A", "Track B"],
        duration_seconds: 60,
      })
    );
    pollId = (await res.json()).poll_id;
  });

  it("records a vote and increments the count", async () => {
    const voteRes = await votePoll(
      makeVoteRequest({ poll_id: pollId, viewer_id: "viewer-1", option_index: 0 })
    );
    expect(voteRes.status).toBe(200);
    expect((await voteRes.json()).message).toBe("Vote recorded");

    const getRes = await getPoll(makeRequest("GET", undefined, { poll_id: pollId }));
    const body = await getRes.json();
    expect(body.options[0].votes).toBe(1);
    expect(body.options[1].votes).toBe(0);
    expect(body.total_votes).toBe(1);
  });

  it("rejects duplicate vote from the same viewer", async () => {
    await votePoll(
      makeVoteRequest({ poll_id: pollId, viewer_id: "viewer-1", option_index: 0 })
    );
    const dupRes = await votePoll(
      makeVoteRequest({ poll_id: pollId, viewer_id: "viewer-1", option_index: 1 })
    );
    expect(dupRes.status).toBe(409);

    const getRes = await getPoll(makeRequest("GET", undefined, { poll_id: pollId }));
    const body = await getRes.json();
    expect(body.total_votes).toBe(1);
  });

  it("allows different viewers to vote", async () => {
    await votePoll(
      makeVoteRequest({ poll_id: pollId, viewer_id: "viewer-1", option_index: 0 })
    );
    await votePoll(
      makeVoteRequest({ poll_id: pollId, viewer_id: "viewer-2", option_index: 0 })
    );
    await votePoll(
      makeVoteRequest({ poll_id: pollId, viewer_id: "viewer-3", option_index: 1 })
    );

    const getRes = await getPoll(makeRequest("GET", undefined, { poll_id: pollId }));
    const body = await getRes.json();
    expect(body.options[0].votes).toBe(2);
    expect(body.options[1].votes).toBe(1);
    expect(body.total_votes).toBe(3);
  });

  it("rejects vote with invalid option_index", async () => {
    const res = await votePoll(
      makeVoteRequest({ poll_id: pollId, viewer_id: "viewer-1", option_index: 99 })
    );
    expect(res.status).toBe(400);
  });

  it("rejects vote for nonexistent poll", async () => {
    const res = await votePoll(
      makeVoteRequest({ poll_id: "nonexistent", viewer_id: "viewer-1", option_index: 0 })
    );
    expect(res.status).toBe(404);
  });
});

describe("Poll expiry", () => {
  it("rejects vote after poll ends", async () => {
    resetStore();
    const res = await createPoll(
      makeRequest("POST", {
        stream_id: "stream-1",
        question: "Quick poll",
        options: ["Yes", "No"],
        duration_seconds: 60,
      })
    );
    const { poll_id } = await res.json();

    const store = getStore();
    const poll = store.get(poll_id)!;
    poll.ends_at = new Date(0).toISOString();

    const voteRes = await votePoll(
      makeVoteRequest({ poll_id, viewer_id: "viewer-1", option_index: 0 })
    );
    expect(voteRes.status).toBe(400);
    const body = await voteRes.json();
    expect(body.error).toBe("Poll has ended");
  });
});
