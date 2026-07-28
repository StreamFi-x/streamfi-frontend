import { NextRequest } from "next/server";
import { POST } from "./route";
import { PUT, DEFAULT_TEMPLATE } from "../route";

function makePutReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/notification-preview-template", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeRenderReq(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/notification-preview-template/render", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/routesF/notification-preview-template/render", () => {
  it("interpolates {{title}} using the default template when no custom one is set", async () => {
    const res = await POST(makeRenderReq({ creator_id: "creator-render-default", stream_title: "Speedrun Sunday" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rendered_text).toBe(DEFAULT_TEMPLATE.replace("{{title}}", "Speedrun Sunday"));
  });

  it("interpolates {{title}} using a previously saved custom template", async () => {
    await PUT(makePutReq({ creator_id: "creator-render-custom", preview_template: "Don't miss {{title}}!" }));

    const res = await POST(makeRenderReq({ creator_id: "creator-render-custom", stream_title: "Boss Rush" }));
    const data = await res.json();

    expect(data.rendered_text).toBe("Don't miss Boss Rush!");
  });

  it("supports multiple {{title}} occurrences in one template", async () => {
    await PUT(makePutReq({ creator_id: "creator-multi", preview_template: "{{title}} - {{title}}" }));

    const res = await POST(makeRenderReq({ creator_id: "creator-multi", stream_title: "Live" }));
    const data = await res.json();

    expect(data.rendered_text).toBe("Live - Live");
  });

  it("returns 400 when stream_title is missing", async () => {
    const res = await POST(makeRenderReq({ creator_id: "creator-x" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when creator_id is missing", async () => {
    const res = await POST(makeRenderReq({ stream_title: "Live" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/routesF/notification-preview-template/render", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
