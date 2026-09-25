/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PUT } from "../route";
import { catalog, resetCatalog } from "../store";
import { applyUpdate, validateUpdateFields } from "../utils";

function makeReq(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/channel-points-catalog-update",
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

beforeEach(() => {
  resetCatalog();
});

describe("PUT /api/routes-f/channel-points-catalog-update", () => {
  describe("Validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest(
        "http://localhost/api/routes-f/channel-points-catalog-update",
        { method: "PUT", body: "not json" }
      );
      expect((await PUT(req)).status).toBe(400);
    });

    it("returns 400 when creatorId is missing", async () => {
      const res = await PUT(makeReq({ rewardId: "reward_emote", cost: 100 }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("creatorId");
    });

    it("returns 400 when rewardId is missing", async () => {
      const res = await PUT(makeReq({ creatorId: "creator_a", cost: 100 }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("rewardId");
    });

    it("returns 400 when no updatable field is supplied", async () => {
      const res = await PUT(
        makeReq({ creatorId: "creator_a", rewardId: "reward_emote" })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("at least one of");
    });

    it.each([
      ["title", ""],
      ["title", "   "],
      ["title", 42],
      ["cost", 0],
      ["cost", -5],
      ["cost", 1.5],
      ["cost", "500"],
      ["cooldown", -1],
      ["cooldown", 2.5],
      ["stock", -1],
      ["stock", 3.5],
      ["stock", "10"],
    ])("returns 400 for invalid %s value %p", async (field, value) => {
      const res = await PUT(
        makeReq({
          creatorId: "creator_a",
          rewardId: "reward_emote",
          [field]: value,
        })
      );
      expect(res.status).toBe(400);
    });
  });

  describe("Lookup failures", () => {
    it("returns 404 when the reward does not exist", async () => {
      const res = await PUT(
        makeReq({
          creatorId: "creator_a",
          rewardId: "reward_missing",
          cost: 100,
        })
      );
      expect(res.status).toBe(404);
      expect((await res.json()).error).toContain("not found");
    });

    it("returns 403 when the reward belongs to a different creator", async () => {
      const res = await PUT(
        makeReq({
          creatorId: "creator_a",
          rewardId: "reward_song", // owned by creator_b
          cost: 100,
        })
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toContain("does not belong");
    });

    it("does not mutate the reward on a failed authorization check", async () => {
      const before = { ...catalog.get("reward_song")! };
      await PUT(
        makeReq({ creatorId: "creator_a", rewardId: "reward_song", cost: 1 })
      );
      expect(catalog.get("reward_song")).toEqual(before);
    });
  });

  describe("Successful updates", () => {
    it("updates every field and bumps updated_at", async () => {
      const before = { ...catalog.get("reward_shoutout")! };
      const res = await PUT(
        makeReq({
          creatorId: "creator_a",
          rewardId: "reward_shoutout",
          title: "  VIP Shoutout  ",
          cost: 2000,
          cooldown: 600,
          stock: 5,
        })
      );
      expect(res.status).toBe(200);
      const { reward } = await res.json();

      expect(reward).toMatchObject({
        reward_id: "reward_shoutout",
        creator_id: "creator_a",
        title: "VIP Shoutout", // trimmed
        cost: 2000,
        cooldown: 600,
        stock: 5,
      });
      expect(reward.updated_at).not.toBe(before.updated_at);
      // Persisted to the store.
      expect(catalog.get("reward_shoutout")).toEqual(reward);
    });

    it("applies a partial update and leaves other fields untouched", async () => {
      const before = { ...catalog.get("reward_emote")! };
      const res = await PUT(
        makeReq({
          creatorId: "creator_a",
          rewardId: "reward_emote",
          cost: 750,
        })
      );
      const { reward } = await res.json();

      expect(reward.cost).toBe(750);
      expect(reward.title).toBe(before.title);
      expect(reward.cooldown).toBe(before.cooldown);
      expect(reward.stock).toBe(before.stock);
    });

    it("accepts stock: null to mark a reward unlimited", async () => {
      const res = await PUT(
        makeReq({
          creatorId: "creator_b",
          rewardId: "reward_song",
          stock: null,
        })
      );
      expect(res.status).toBe(200);
      expect((await res.json()).reward.stock).toBeNull();
    });

    it("accepts stock: 0 (sold out but still listed)", async () => {
      const res = await PUT(
        makeReq({
          creatorId: "creator_b",
          rewardId: "reward_song",
          stock: 0,
        })
      );
      expect(res.status).toBe(200);
      expect((await res.json()).reward.stock).toBe(0);
    });

    it("accepts cooldown: 0", async () => {
      const res = await PUT(
        makeReq({
          creatorId: "creator_a",
          rewardId: "reward_emote",
          cooldown: 0,
        })
      );
      expect(res.status).toBe(200);
      expect((await res.json()).reward.cooldown).toBe(0);
    });
  });

  describe("utils: validateUpdateFields", () => {
    it("rejects a payload with only creatorId/rewardId", () => {
      expect(
        validateUpdateFields({
          creatorId: "creator_a",
          rewardId: "reward_emote",
        })
      ).toContain("at least one of");
    });

    it("passes a payload with a single valid field", () => {
      expect(validateUpdateFields({ cost: 100 })).toBeNull();
    });
  });

  describe("utils: applyUpdate", () => {
    it("only touches the supplied fields", () => {
      const reward = catalog.get("reward_emote")!;
      const updated = applyUpdate(reward, { title: "New Title" });
      expect(updated.title).toBe("New Title");
      expect(updated.cost).toBe(reward.cost);
      expect(updated).not.toBe(reward); // returns a copy
    });
  });
});
