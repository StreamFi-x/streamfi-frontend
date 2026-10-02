/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PUT } from "../email-digest/route";
import { resetStore } from "../email-digest/store";
import { VALID_SECTIONS, isValidSection, validateSections } from "../email-digest/sections";

function makePut(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/email-digest", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => resetStore());

describe("email-digest section validation helpers", () => {
  it("VALID_SECTIONS contains all four allowed values", () => {
    expect(VALID_SECTIONS).toContain("live_alerts");
    expect(VALID_SECTIONS).toContain("new_clips");
    expect(VALID_SECTIONS).toContain("tip_summary");
    expect(VALID_SECTIONS).toContain("recommendations");
    expect(VALID_SECTIONS).toHaveLength(4);
  });

  it("isValidSection returns true for known sections", () => {
    expect(isValidSection("live_alerts")).toBe(true);
    expect(isValidSection("recommendations")).toBe(true);
  });

  it("isValidSection returns false for unknown strings", () => {
    expect(isValidSection("weekly_recap")).toBe(false);
    expect(isValidSection("")).toBe(false);
  });

  it("validateSections returns typed array for valid input", () => {
    const result = validateSections(["live_alerts", "tip_summary"]);
    expect(result).toEqual(["live_alerts", "tip_summary"]);
  });

  it("validateSections returns null for invalid input", () => {
    expect(validateSections(["live_alerts", "bad_section"])).toBeNull();
  });
});

describe("PUT /api/routes-f/email-digest section validation", () => {
  it("returns 400 for unrecognised section value", async () => {
    const res = await PUT(
      makePut({
        viewer_id: "viewer_001",
        sections: ["live_alerts", "weekly_recap"],
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts all four sections in one PUT", async () => {
    const res = await PUT(
      makePut({
        viewer_id: "viewer_001",
        sections: ["live_alerts", "new_clips", "tip_summary", "recommendations"],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sections).toHaveLength(4);
  });

  it("accepts empty sections array to opt out of all digest content", async () => {
    const res = await PUT(
      makePut({ viewer_id: "viewer_001", sections: [] })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sections).toEqual([]);
  });
});
