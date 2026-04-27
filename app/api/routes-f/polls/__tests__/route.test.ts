jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { POST as createPoll } from "../route";
import { GET as getPoll } from "../[id]/route";
import { POST as voteOnPoll } from "../[id]/vote/route";
import { __resetPollStore } from "../_lib/store";

function makeRequest(method: string, body?: object, ip = "198.51.100.10") {
  return new Request("http://localhost/api/routes-f/polls", {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("poll routes", () => {
  beforeEach(() => {
    __resetPollStore();
  });

  it("validates that poll creation needs 2-6 options", async () => {
    const response = await createPoll(
      makeRequest("POST", {
        question: "Best stream time?",
        options: ["Morning"],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/between 2 and 6/i);
  });

  it("creates a poll and fetches it by id", async () => {
    const createResponse = await createPoll(
      makeRequest("POST", {
        question: "Best stream time?",
        options: ["Morning", "Evening", "Late night"],
      })
    );
    const createdBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createdBody.poll.options).toHaveLength(3);

    const getResponse = await getPoll(new Request("http://localhost"), {
      params: Promise.resolve({ id: createdBody.poll.id }),
    });
    const fetchedBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(fetchedBody.poll.question).toBe("Best stream time?");
    expect(fetchedBody.poll.total_votes).toBe(0);
  });

  it("records votes and returns updated counts", async () => {
    const createResponse = await createPoll(
      makeRequest("POST", {
        question: "Favorite feature?",
        options: ["Chat", "Tips"],
      })
    );
    const createdBody = await createResponse.json();

    const voteResponse = await voteOnPoll(
      makeRequest("POST", { option_index: 1 }, "198.51.100.12"),
      { params: Promise.resolve({ id: createdBody.poll.id }) }
    );
    const votedBody = await voteResponse.json();

    expect(voteResponse.status).toBe(200);
    expect(votedBody.poll.options[0].vote_count).toBe(0);
    expect(votedBody.poll.options[1].vote_count).toBe(1);
    expect(votedBody.poll.total_votes).toBe(1);
  });

  it("rejects duplicate votes from the same IP for a poll", async () => {
    const createResponse = await createPoll(
      makeRequest("POST", {
        question: "Favorite feature?",
        options: ["Chat", "Tips"],
      })
    );
    const createdBody = await createResponse.json();

    await voteOnPoll(makeRequest("POST", { option_index: 0 }, "203.0.113.9"), {
      params: Promise.resolve({ id: createdBody.poll.id }),
    });

    const secondVoteResponse = await voteOnPoll(
      makeRequest("POST", { option_index: 1 }, "203.0.113.9"),
      { params: Promise.resolve({ id: createdBody.poll.id }) }
    );
    const secondVoteBody = await secondVoteResponse.json();

    expect(secondVoteResponse.status).toBe(409);
    expect(secondVoteBody.error).toMatch(/already voted/i);
  });
});
