import { NextRequest } from "next/server";
import { POST } from "../route";
import { balances, balanceKey } from "../seedData";

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel-points-redemption-reject", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routes-f/channel-points-redemption-reject", () => {
  it("rejects a pending redemption and refunds the points", async () => {
    const before = balances.get(balanceKey("viewer_1", "creator_a")) ?? 0;

    const res = await POST(
      makePost({ redemption_id: "redemption_pending_1", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.redemption.status).toBe("rejected");
    expect(body.redemption.resolved_by).toBe("mod_1");
    expect(body.refunded_amount).toBe(500);
    expect(body.new_balance).toBe(before + 500);
    expect(balances.get(balanceKey("viewer_1", "creator_a"))).toBe(before + 500);
  });

  it("returns 404 for an unknown redemption_id", async () => {
    const res = await POST(
      makePost({ redemption_id: "does_not_exist", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when the redemption is already rejected", async () => {
    const res = await POST(
      makePost({ redemption_id: "redemption_already_rejected", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when the redemption is already approved", async () => {
    const res = await POST(
      makePost({ redemption_id: "redemption_already_approved", moderator_id: "mod_1" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when redemption_id is missing", async () => {
    const res = await POST(makePost({ moderator_id: "mod_1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when moderator_id is missing", async () => {
    const res = await POST(makePost({ redemption_id: "redemption_pending_2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/routes-f/channel-points-redemption-reject", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("does not allow rejecting the same redemption twice", async () => {
    const first = await POST(
      makePost({ redemption_id: "redemption_pending_2", moderator_id: "mod_1" })
    );
    expect(first.status).toBe(200);

    const second = await POST(
      makePost({ redemption_id: "redemption_pending_2", moderator_id: "mod_2" })
    );
    expect(second.status).toBe(409);
  });
});
