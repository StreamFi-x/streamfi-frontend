import { POST, KNOWN_CREATORS } from "./route";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/clip-creator-mentions";

async function postMentions(body: unknown) {
  const res = await POST(
    new NextRequest(BASE, {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
  return { res, data: await res.json() };
}

describe("Clip Creator Mentions", () => {
  describe("POST /api/routes-f/clip-creator-mentions", () => {
    it("should return 400 when clip_id is missing", async () => {
      const { res } = await postMentions({ title: "Hello @pixelpatch" });
      expect(res.status).toBe(400);
    });

    it("should return 400 when title is missing", async () => {
      const { res } = await postMentions({ clip_id: "clip-1" });
      expect(res.status).toBe(400);
    });

    it("should extract a known creator mention from the title", async () => {
      const { res, data } = await postMentions({
        clip_id: "clip-1",
        title: "Shoutout to @pixelpatch for the assist",
      });
      expect(res.status).toBe(200);
      expect(data.mentions).toEqual(["pixelpatch"]);
    });

    it("should extract mentions from the description too", async () => {
      const { data } = await postMentions({
        clip_id: "clip-1",
        title: "Clutch round",
        description: "ft. @walletwiz and @raidmaster",
      });
      expect(data.mentions.sort()).toEqual(["raidmaster", "walletwiz"]);
    });

    it("should ignore unknown handles that aren't in the creators list", async () => {
      const { data } = await postMentions({
        clip_id: "clip-1",
        title: "Thanks @randomviewer123",
      });
      expect(data.mentions).toEqual([]);
    });

    it("should skip a mention of the clip's own creator", async () => {
      const { data } = await postMentions({
        clip_id: "clip-1", // owned by novastreams
        title: "Big shoutout @novastreams @pixelpatch",
      });
      expect(data.mentions).toEqual(["pixelpatch"]);
    });

    it("should de-duplicate repeated mentions", async () => {
      const { data } = await postMentions({
        clip_id: "clip-2",
        title: "@walletwiz @walletwiz @walletwiz",
      });
      expect(data.mentions).toEqual(["walletwiz"]);
    });

    it("should return an empty mentions array when there are none", async () => {
      const { res, data } = await postMentions({
        clip_id: "clip-1",
        title: "No mentions here",
      });
      expect(res.status).toBe(200);
      expect(data.mentions).toEqual([]);
    });

    it("sanity: KNOWN_CREATORS is non-empty", () => {
      expect(KNOWN_CREATORS.length).toBeGreaterThan(0);
    });
  });
});
