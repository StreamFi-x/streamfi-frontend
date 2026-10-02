/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";
import { buildSections, getNextScheduledSend } from "../utils";
import { getOptIns, defaultOptIns } from "../seedData";

function makeReq(viewerId?: string): NextRequest {
  const url = viewerId
    ? `http://localhost/api/routes-f/digest-preview?viewer_id=${viewerId}`
    : "http://localhost/api/routes-f/digest-preview";
  return new NextRequest(url);
}

describe("GET /api/routes-f/digest-preview", () => {
  describe("Required Parameters", () => {
    it("returns 400 when viewer_id is missing", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("viewer_id");
    });
  });

  describe("Mixed opt-ins", () => {
    it("returns all four sections for a viewer opted into everything", async () => {
      const res = await GET(makeReq("viewer_all_optin"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.sections).toHaveLength(4);
      const titles = body.sections.map((s: { title: string }) => s.title);
      expect(titles).toEqual([
        "Live now from creators you follow",
        "New streams this week",
        "Your tips recap",
        "Recommended for you",
      ]);
      expect(body.sections[2].items.length).toBeGreaterThan(0);
    });

    it("returns only opted-in sections for a viewer with mixed opt-ins", async () => {
      const res = await GET(makeReq("viewer_mixed_optin"));
      expect(res.status).toBe(200);
      const body = await res.json();

      const titles = body.sections.map((s: { title: string }) => s.title);
      expect(titles).toEqual([
        "Live now from creators you follow",
        "Your tips recap",
      ]);
      expect(titles).not.toContain("New streams this week");
      expect(titles).not.toContain("Recommended for you");
    });

    it("returns no sections for a viewer opted out of everything", async () => {
      const res = await GET(makeReq("viewer_none_optin"));
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.sections).toEqual([]);
    });

    it("applies defaults for an unknown viewer_id", async () => {
      const res = await GET(makeReq("some_unknown_viewer_xyz"));
      expect(res.status).toBe(200);
      const body = await res.json();

      const titles = body.sections.map((s: { title: string }) => s.title);
      expect(titles).toEqual([
        "Live now from creators you follow",
        "New streams this week",
        "Recommended for you",
      ]);
    });
  });

  describe("Section item shape", () => {
    it("every item has id, title, and subtitle", async () => {
      const res = await GET(makeReq("viewer_all_optin"));
      const body = await res.json();

      for (const section of body.sections) {
        for (const item of section.items) {
          expect(item).toHaveProperty("id");
          expect(item).toHaveProperty("title");
          expect(item).toHaveProperty("subtitle");
        }
      }
    });

    it("tips recap is personalized per viewer", async () => {
      const res = await GET(makeReq("viewer_mixed_optin"));
      const body = await res.json();

      const tipsSection = body.sections.find(
        (s: { title: string }) => s.title === "Your tips recap"
      );
      expect(tipsSection.items).toHaveLength(1);
      expect(tipsSection.items[0].title).toContain("pixel_forge");
    });
  });

  describe("scheduled_send", () => {
    it("is a valid ISO date string in the future", async () => {
      const res = await GET(makeReq("viewer_all_optin"));
      const body = await res.json();

      expect(typeof body.scheduled_send).toBe("string");
      const parsed = new Date(body.scheduled_send);
      expect(parsed.toISOString()).toBe(body.scheduled_send);
      expect(parsed.getTime()).toBeGreaterThan(Date.now());
    });

    it("lands on 09:00 UTC", async () => {
      const res = await GET(makeReq("viewer_all_optin"));
      const body = await res.json();
      const parsed = new Date(body.scheduled_send);
      expect(parsed.getUTCHours()).toBe(9);
      expect(parsed.getUTCMinutes()).toBe(0);
    });
  });

  describe("utils: getNextScheduledSend", () => {
    it("rolls to today 09:00 UTC when called before that time", () => {
      const before = new Date(Date.UTC(2026, 0, 15, 3, 0, 0));
      const result = getNextScheduledSend(before);
      expect(result).toBe(new Date(Date.UTC(2026, 0, 15, 9, 0, 0)).toISOString());
    });

    it("rolls to tomorrow 09:00 UTC when called after that time", () => {
      const after = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
      const result = getNextScheduledSend(after);
      expect(result).toBe(new Date(Date.UTC(2026, 0, 16, 9, 0, 0)).toISOString());
    });

    it("rolls to tomorrow 09:00 UTC when called exactly at 09:00 UTC", () => {
      const exact = new Date(Date.UTC(2026, 0, 15, 9, 0, 0));
      const result = getNextScheduledSend(exact);
      expect(result).toBe(new Date(Date.UTC(2026, 0, 16, 9, 0, 0)).toISOString());
    });
  });

  describe("utils: buildSections", () => {
    it("returns empty array when all opt-ins are false", () => {
      const optIns = defaultOptIns("x");
      const sections = buildSections({
        ...optIns,
        followed_live: false,
        new_streams: false,
        tips_recap: false,
        recommended: false,
      });
      expect(sections).toEqual([]);
    });
  });

  describe("seedData: getOptIns", () => {
    it("returns seeded opt-ins for a known viewer", () => {
      const optIns = getOptIns("viewer_none_optin");
      expect(optIns.followed_live).toBe(false);
      expect(optIns.tips_recap).toBe(false);
    });

    it("returns defaults for an unknown viewer", () => {
      const optIns = getOptIns("totally_unknown_viewer");
      expect(optIns).toEqual(defaultOptIns("totally_unknown_viewer"));
    });
  });
});
