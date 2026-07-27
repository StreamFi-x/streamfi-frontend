import { NextRequest } from "next/server";
import { POST, pickCrossPromo } from "./route";
import { LIVE_STREAMS } from "./seed";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/stream-end-promo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Stream End Cross-Promo API", () => {
  it("promotes the live creator with the highest follower overlap", async () => {
    const res = await POST(makeReq({ ending_creator_id: "c103" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    // c103 overlaps c102 at 0.55 and c101 at 0.12 — c102 wins
    expect(data.promoted_creator.creator_id).toBe("c102");
    expect(data.promoted_creator.follower_overlap).toBe(0.55);
    expect(data.reason).toContain("LoFiLounge");
    expect(data.reason).toContain("55%");
  });

  it("never promotes the creator who is ending", async () => {
    const res = await POST(makeReq({ ending_creator_id: "c102" }));
    const data = await res.json();

    expect(data.promoted_creator.creator_id).not.toBe("c102");
  });

  it("falls back when no live creator has follower overlap", async () => {
    // c199's community has no measured overlap with any live creator
    const res = await POST(makeReq({ ending_creator_id: "c199" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.promoted_creator).toBeNull();
    expect(data.reason).toContain("No live creators");
  });

  it("falls back when the ending creator is the only one live", () => {
    const soloLive = LIVE_STREAMS.filter((s) => s.creator_id === "c101");
    const result = pickCrossPromo("c101", soloLive);

    expect(result.promoted_creator).toBeNull();
  });

  it("falls back when nothing is live at all", () => {
    const result = pickCrossPromo("c101", []);
    expect(result.promoted_creator).toBeNull();
  });

  it("includes the fields the promo card renders", async () => {
    const res = await POST(makeReq({ ending_creator_id: "c101" }));
    const { promoted_creator } = await res.json();

    expect(promoted_creator).toHaveProperty("creator_id");
    expect(promoted_creator).toHaveProperty("username");
    expect(promoted_creator).toHaveProperty("stream_id");
    expect(promoted_creator).toHaveProperty("category");
    expect(promoted_creator).toHaveProperty("viewers");
    expect(promoted_creator).toHaveProperty("follower_overlap");
  });

  it("rejects a missing ending_creator_id with 400", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new NextRequest("http://localhost/api/routesF/stream-end-promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "oops",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
