/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../email-digest/route";
import { resetStore } from "../email-digest/store";

function makeGet(viewerId: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/email-digest?viewer_id=${viewerId}`
  );
}

function makePut(body: unknown) {
  return new NextRequest("http://localhost/api/routes-f/email-digest", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => resetStore());

describe("GET /api/routes-f/email-digest", () => {
  it("returns seeded prefs for known viewer", async () => {
    const res = await GET(makeGet("viewer_001"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
    expect(data.day_of_week).toBe("monday");
    expect(data.sections).toContain("live_alerts");
    expect(data.sections).toContain("tip_summary");
  });

  it("returns disabled defaults for unknown viewer", async () => {
    const res = await GET(makeGet("unknown_viewer"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(false);
    expect(Array.isArray(data.sections)).toBe(true);
  });

  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/routes-f/email-digest")
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/routes-f/email-digest", () => {
  it("toggles enabled flag", async () => {
    const res = await PUT(
      makePut({ viewer_id: "viewer_001", enabled: false })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(false);
    expect(data.day_of_week).toBe("monday");
  });

  it("updates day_of_week", async () => {
    const res = await PUT(
      makePut({ viewer_id: "viewer_001", day_of_week: "thursday" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.day_of_week).toBe("thursday");
    expect(data.enabled).toBe(true);
  });

  it("updates sections subset", async () => {
    const res = await PUT(
      makePut({
        viewer_id: "viewer_001",
        sections: ["new_clips", "recommendations"],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sections).toEqual(["new_clips", "recommendations"]);
  });

  it("creates new prefs for unknown viewer via PUT", async () => {
    const res = await PUT(
      makePut({
        viewer_id: "viewer_new",
        enabled: true,
        day_of_week: "saturday",
        sections: ["tip_summary"],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
    expect(data.day_of_week).toBe("saturday");
    expect(data.sections).toEqual(["tip_summary"]);
  });

  it("GET reflects updated prefs after PUT", async () => {
    await PUT(makePut({ viewer_id: "viewer_002", enabled: true }));
    const res = await GET(makeGet("viewer_002"));
    const data = await res.json();
    expect(data.enabled).toBe(true);
  });
});
