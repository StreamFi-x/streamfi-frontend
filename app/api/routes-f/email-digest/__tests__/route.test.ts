jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

import { GET, PUT, __resetEmailDigest } from "../route";

const makeGetRequest = (search: string): import("next/server").NextRequest =>
  new Request(
    `http://localhost/api/routes-f/email-digest${search}`
  ) as unknown as import("next/server").NextRequest;

const makePutRequest = (body: unknown): import("next/server").NextRequest =>
  new Request("http://localhost/api/routes-f/email-digest", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;

beforeEach(() => {
  __resetEmailDigest();
});

describe("GET /api/routes-f/email-digest — validation", () => {
  it("returns 400 when viewer_id is missing", async () => {
    const res = await GET(makeGetRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown viewer", async () => {
    const res = await GET(makeGetRequest("?viewer_id=nobody"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/routes-f/email-digest — read preferences", () => {
  it("returns enabled digest preferences for viewer_001", async () => {
    const res = await GET(makeGetRequest("?viewer_id=viewer_001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.day_of_week).toBe(1);
    expect(body.sections).toEqual(["live_alerts", "new_clips"]);
  });

  it("returns disabled digest for viewer_002", async () => {
    const res = await GET(makeGetRequest("?viewer_id=viewer_002"));
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.sections).toEqual([]);
  });
});

describe("PUT /api/routes-f/email-digest — toggle and section selection", () => {
  it("toggles enabled to false", async () => {
    const res = await PUT(
      makePutRequest({ viewer_id: "viewer_001", enabled: false })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
  });

  it("updates day_of_week", async () => {
    const res = await PUT(
      makePutRequest({ viewer_id: "viewer_001", day_of_week: 3 })
    );
    const body = await res.json();
    expect(body.day_of_week).toBe(3);
  });

  it("updates sections selection", async () => {
    const res = await PUT(
      makePutRequest({
        viewer_id: "viewer_002",
        sections: ["tip_summary", "recommendations"],
      })
    );
    const body = await res.json();
    expect(body.sections).toEqual(["tip_summary", "recommendations"]);
  });

  it("returns 400 for invalid section value", async () => {
    const res = await PUT(
      makePutRequest({ viewer_id: "viewer_001", sections: ["invalid_section"] })
    );
    expect(res.status).toBe(400);
  });

  it("persists changes visible on subsequent GET", async () => {
    await PUT(
      makePutRequest({
        viewer_id: "viewer_001",
        enabled: false,
        sections: ["tip_summary"],
      })
    );
    const res = await GET(makeGetRequest("?viewer_id=viewer_001"));
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.sections).toEqual(["tip_summary"]);
  });
});