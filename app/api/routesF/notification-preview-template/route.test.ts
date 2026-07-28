import { NextRequest } from "next/server";
import { GET, PUT, DEFAULT_TEMPLATE, MAX_TEMPLATE_LENGTH } from "./route";

function makeGetReq(creatorId: string | null) {
  const url = new URL("http://localhost/api/routesF/notification-preview-template");
  if (creatorId !== null) url.searchParams.set("creator_id", creatorId);
  return new NextRequest(url);
}

function makePutReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/notification-preview-template", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/routesF/notification-preview-template", () => {
  it("returns the default template for a creator with no custom template set", async () => {
    const res = await GET(makeGetReq("creator-default"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.preview_template).toBe(DEFAULT_TEMPLATE);
  });

  it("returns a previously set custom template", async () => {
    await PUT(makePutReq({ creator_id: "creator-custom", preview_template: "{{title}} just went live!" }));

    const res = await GET(makeGetReq("creator-custom"));
    const data = await res.json();

    expect(data.preview_template).toBe("{{title}} just went live!");
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await GET(makeGetReq(null));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/routesF/notification-preview-template", () => {
  it("updates the template for a creator", async () => {
    const res = await PUT(makePutReq({ creator_id: "creator-update", preview_template: "New: {{title}}" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.preview_template).toBe("New: {{title}}");
  });

  it("caps the template at MAX_TEMPLATE_LENGTH characters", async () => {
    const tooLong = "x".repeat(MAX_TEMPLATE_LENGTH + 1);
    const res = await PUT(makePutReq({ creator_id: "creator-toolong", preview_template: tooLong }));
    expect(res.status).toBe(400);
  });

  it("accepts a template exactly at MAX_TEMPLATE_LENGTH characters", async () => {
    const exact = "x".repeat(MAX_TEMPLATE_LENGTH);
    const res = await PUT(makePutReq({ creator_id: "creator-exact", preview_template: exact }));
    expect(res.status).toBe(200);
  });

  it("returns 400 when preview_template is missing", async () => {
    const res = await PUT(makePutReq({ creator_id: "creator-missing" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await PUT(makePutReq({ preview_template: "hello" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/notification-preview-template", {
      method: "PUT",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
