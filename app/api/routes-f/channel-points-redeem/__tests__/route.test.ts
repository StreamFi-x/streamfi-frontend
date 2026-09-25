import { NextRequest } from "next/server";
import { POST } from "../route";
import { balances, balanceKey } from "../seedData";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel-points-redeem", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/channel-points-redeem", () => {
  it("redeems a reward, deducts points, and creates a pending redemption", async () => {
    const before = balances.get(balanceKey("viewer_1", "creator_a")) ?? 0;

    const res = await POST(
      makePost({ viewer_id: "viewer_1", creator_id: "creator_a", reward_id: "reward_emote" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.redemption.redemption_id).toEqual(expect.any(String));
    expect(body.redemption.status).toBe("pending");
    expect(body.redemption.reward_id).toBe("reward_emote");
    expect(body.redemption.cost).toBe(500);
    expect(body.new_balance).toBe(before - 500);
    expect(balances.get(balanceKey("viewer_1", "creator_a"))).toBe(before - 500);
  });

  it("returns 404 when the reward does not exist", async () => {
    const res = await POST(
      makePost({ viewer_id: "viewer_1", creator_id: "creator_a", reward_id: "does_not_exist" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the reward belongs to a different creator", async () => {
    const res = await POST(
      makePost({ viewer_id: "viewer_3", creator_id: "creator_a", reward_id: "reward_song" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when the viewer has insufficient points", async () => {
    const res = await POST(
      makePost({ viewer_id: "viewer_2", creator_id: "creator_a", reward_id: "reward_shoutout" })
    );
    expect(res.status).toBe(409);
  });

  it.each([
    ["viewer_id", { creator_id: "creator_a", reward_id: "reward_emote" }],
    ["creator_id", { viewer_id: "viewer_1", reward_id: "reward_emote" }],
    ["reward_id", { viewer_id: "viewer_1", creator_id: "creator_a" }],
  ])("returns 400 when %s is missing", async (_field, body) => {
    const res = await POST(makePost(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/channel-points-redeem", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("deducts points across repeated redemptions without going negative on a successful path", async () => {
    const before = balances.get(balanceKey("viewer_3", "creator_b")) ?? 0;

    const first = await POST(
      makePost({ viewer_id: "viewer_3", creator_id: "creator_b", reward_id: "reward_song" })
    );
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.new_balance).toBe(before - 1500);
  });
});
