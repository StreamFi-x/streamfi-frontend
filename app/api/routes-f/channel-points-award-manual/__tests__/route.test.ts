import { NextRequest } from "next/server";
import { POST } from "../route";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel-points-award-manual", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/channel-points-award-manual", () => {
  it("awards points and returns the updated balance", async () => {
    const res = await POST(
      makePost({
        moderator_id: "mod_1",
        viewer_id: "viewer_test_1",
        creator_id: "creator_test_1",
        amount: 250,
        reason: "Great question in chat",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.award_id).toEqual(expect.any(String));
    expect(body.new_balance).toBe(250);
    expect(body.reason).toBe("Great question in chat");
  });

  it("accumulates points across repeated awards", async () => {
    const params = {
      moderator_id: "mod_1",
      viewer_id: "viewer_test_2",
      creator_id: "creator_test_2",
      reason: "Bonus",
    };
    const first = await POST(makePost({ ...params, amount: 100 }));
    const firstBody = await first.json();
    expect(firstBody.new_balance).toBe(100);

    const second = await POST(makePost({ ...params, amount: 50 }));
    const secondBody = await second.json();
    expect(secondBody.new_balance).toBe(150);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/channel-points-award-manual", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it.each([
    ["moderator_id", { viewer_id: "v", creator_id: "c", amount: 10, reason: "r" }],
    ["viewer_id", { moderator_id: "m", creator_id: "c", amount: 10, reason: "r" }],
    ["creator_id", { moderator_id: "m", viewer_id: "v", amount: 10, reason: "r" }],
    ["reason", { moderator_id: "m", viewer_id: "v", creator_id: "c", amount: 10 }],
  ])("returns 400 when %s is missing", async (_field, body) => {
    const res = await POST(makePost(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is not a positive integer", async () => {
    const base = { moderator_id: "m", viewer_id: "v", creator_id: "c", reason: "r" };
    for (const amount of [0, -10, 1.5, "100"]) {
      const res = await POST(makePost({ ...base, amount }));
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 when amount exceeds the maximum", async () => {
    const res = await POST(
      makePost({
        moderator_id: "m",
        viewer_id: "v",
        creator_id: "c",
        amount: 10_000_000,
        reason: "r",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when reason is empty or whitespace", async () => {
    const base = { moderator_id: "m", viewer_id: "v", creator_id: "c", amount: 10 };
    const res1 = await POST(makePost({ ...base, reason: "" }));
    expect(res1.status).toBe(400);
    const res2 = await POST(makePost({ ...base, reason: "   " }));
    expect(res2.status).toBe(400);
  });
});
